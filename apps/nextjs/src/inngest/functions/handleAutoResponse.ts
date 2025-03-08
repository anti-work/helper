import { eq } from "drizzle-orm";
import { assertDefined } from "@/components/utils/assert";
import { db } from "@/db/client";
import { conversationMessages } from "@/db/schema";
import AutoReplyEmail from "@/emails/autoReply";
import { inngest } from "@/inngest/client";
import { checkTokenCountAndSummarizeIfNeeded, createAssistantMessage, generateAIResponse } from "@/lib/ai/chat";
import { cleanUpTextForAI } from "@/lib/ai/core";
import { updateConversation } from "@/lib/data/conversation";
import { createMessageNotification } from "@/lib/data/messageNotifications";
import { getCachedSubscriptionStatus } from "@/lib/data/organization";
import { findOrCreatePlatformCustomerByEmail } from "@/lib/data/platformCustomer";
import { sendEmail } from "@/lib/resend/client";

export const handleAutoResponse = async (messageId: number) => {
  const message = await db.query.conversationMessages
    .findFirst({
      where: eq(conversationMessages.id, messageId),
      with: {
        conversation: {
          with: {
            mailbox: true,
          },
        },
      },
    })
    .then(assertDefined);

  const widgetHost = message.conversation.mailbox.widgetHost;
  if (!widgetHost) throw new Error("Widget host is required for auto-response");

  if ((await getCachedSubscriptionStatus(message.conversation.mailbox.clerkOrganizationId)) === "free_trial_expired") {
    return { message: "Not sent, free trial expired" };
  }

  const platformCustomer = assertDefined(
    await findOrCreatePlatformCustomerByEmail(message.conversation.mailboxId, assertDefined(message.emailFrom)),
  );

  const messageText = cleanUpTextForAI(message.cleanedUpText ?? message.body ?? "");
  const processedText = await checkTokenCountAndSummarizeIfNeeded(messageText);

  let aiResponse = "";
  const { textStream } = await generateAIResponse({
    messages: [
      {
        role: "user",
        content: processedText,
        id: message.id.toString(),
      },
    ],
    mailbox: message.conversation.mailbox,
    conversationId: message.conversationId,
    email: assertDefined(message.emailFrom),
  });

  for await (const textPart of textStream) {
    if (textPart) aiResponse += textPart;
  }

  await db.transaction(async (tx) => {
    const assistantMessage = await createAssistantMessage(message.conversationId, message.id, aiResponse);

    await inngest.send({
      name: "conversations/check-resolution",
      data: {
        conversationId: message.conversationId,
        messageId: assistantMessage.id,
      },
    });

    await createMessageNotification({
      messageId: assistantMessage.id,
      conversationId: message.conversationId,
      platformCustomerId: platformCustomer.id,
      notificationText: `You have a new reply for ${message.conversation.subject ?? "(no subject)"}`,
      tx,
    });

    await sendEmail({
      from: "Helper <no-reply@helper.ai>",
      to: assertDefined(message.emailFrom),
      subject: `Re: ${message.conversation.subject ?? "(no subject)"}`,
      react: AutoReplyEmail({
        companyName: message.conversation.mailbox.name,
        widgetHost,
        emailSubject: message.conversation.subject ?? "(no subject)",
      }),
    });

    await updateConversation(message.conversationId, { set: { conversationProvider: "chat", status: "closed" } }, tx);
  });

  return { message: `Auto response sent for message ${messageId}` };
};

export default inngest.createFunction(
  { id: "handle-auto-response" },
  { event: "conversations/auto-response.create" },
  async ({ event, step }) => {
    const { messageId } = event.data;

    return await step.run("handle", async () => await handleAutoResponse(messageId));
  },
);
