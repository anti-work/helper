import { eq } from "drizzle-orm";
import { NonRetriableError } from "inngest";
import { db } from "@/db/client";
import { conversationMessages } from "@/db/schema";
import { inngest } from "@/inngest/client";
import { conversationChannelId, conversationsListChannelId, dashboardChannelId } from "@/lib/ably/channels";
import { publishToAbly } from "@/lib/ably/client";
import { serializeMessage } from "@/lib/data/conversationMessage";
import { createMessageEventPayload } from "@/lib/data/dashboardEvent";
import { getClerkUser } from "@/lib/data/user";
import { captureExceptionAndLogIfDevelopment } from "@/lib/shared/sentry";

export default inngest.createFunction(
  {
    id: "publish-new-conversation-event",
    batchEvents: {
      maxSize: 30,
      timeout: "60s",
    },
    retries: 0,
  },
  { event: "conversations/message.created" },
  async ({ events, step }) => {
    // Process messages serially to ensure consistency on the frontend.
    const messageIds = events.map((event) => event.data.messageId).toSorted((a, b) => a - b);

    await step.run("publish", async () => {
      const failedIds: number[] = [];
      for (const messageId of messageIds) {
        try {
          await publish(messageId);
        } catch (error) {
          captureExceptionAndLogIfDevelopment(error);
          failedIds.push(messageId);
        }
      }
      if (failedIds.length > 0) {
        throw new NonRetriableError(`Failed to publish messages: ${failedIds.join(", ")}`);
      }
    });
  },
);

const publish = async (messageId: number) => {
  const message = await db.query.conversationMessages.findFirst({
    where: eq(conversationMessages.id, messageId),
    with: {
      conversation: {
        with: {
          platformCustomer: true,
          mailbox: true,
        },
      },
    },
  });
  const published = [];
  if (message && message?.role !== "ai_assistant") {
    await publishToAbly({
      channel: conversationChannelId(message.conversation.mailbox.slug, message.conversation.slug),
      event: "conversation.message",
      data: await serializeMessage(message, message.conversation.mailbox, await getClerkUser(message.clerkUserId)),
      trim: (data, amount) => ({
        ...data,
        body: data.body && amount < data.body.length ? data.body.slice(0, data.body.length - amount) : null,
      }),
    });
    published.push("conversation.message");
  }
  if (message?.role === "user" && message.conversation.status === "open") {
    await publishToAbly({
      channel: conversationsListChannelId(message.conversation.mailbox.slug),
      event: "conversation.new",
      data: message.conversation,
    });
    published.push("conversation.new");
  }
  if (message) {
    await publishToAbly({
      channel: dashboardChannelId(message.conversation.mailbox.slug),
      event: "event",
      data: createMessageEventPayload(message, message.conversation.mailbox),
    });
    published.push("realtime.event");
  }
  return `Message ${message?.id} published to Ably: ${published.join(", ") || "none"}`;
};
