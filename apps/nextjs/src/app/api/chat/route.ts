import { createHash } from "crypto";
import { waitUntil } from "@vercel/functions";
import { appendClientMessage, createDataStreamResponse, formatDataStreamPart, type Message } from "ai";
import { authenticateWidget, corsOptions, corsResponse } from "@/app/api/widget/utils";
import { assertDefined } from "@/components/utils/assert";
import { inngest } from "@/inngest/client";
import {
  createAssistantMessage,
  createUserMessage,
  generateAIResponse,
  lastAssistantMessage,
  loadPreviousMessages,
} from "@/lib/ai/chat";
import {
  CHAT_CONVERSATION_SUBJECT,
  generateConversationSubject,
  getConversationBySlugAndMailbox,
  updateConversation,
} from "@/lib/data/conversation";
import { disableAIResponse } from "@/lib/data/conversationMessage";
import { createAndUploadFile } from "@/lib/data/files";
import { type Mailbox } from "@/lib/data/mailbox";
import { getCachedSubscriptionStatus } from "@/lib/data/organization";
import { getPlatformCustomer } from "@/lib/data/platformCustomer";
import { redis } from "@/lib/redis/client";
import { captureExceptionAndLogIfDevelopment } from "@/lib/shared/sentry";
import { WidgetSessionPayload } from "@/lib/widgetSession";
import { ReadPageToolConfig } from "@/sdk/types";

export const maxDuration = 60;

interface ChatRequestBody {
  message: Message;
  token: string;
  conversationSlug: string;
  readPageTool: ReadPageToolConfig | null;
}

const hashQuery = (query: string): string => {
  return createHash("md5").update(query).digest("hex");
};

const getConversation = async (conversationSlug: string, session: WidgetSessionPayload, mailbox: Mailbox) => {
  const conversation = await getConversationBySlugAndMailbox(conversationSlug, mailbox.id);

  if (!conversation) {
    throw new Error("Conversation not found");
  }

  // For anonymous sessions, only allow access if the conversation has no emailFrom
  // For authenticated sessions, only allow access if the emailFrom matches
  if (session.isAnonymous) {
    if (conversation.emailFrom !== null) {
      throw new Error("Unauthorized");
    }
  } else if (session.email && conversation.emailFrom !== session.email) {
    throw new Error("Unauthorized");
  }

  return conversation;
};

function createTextResponse(text: string, messageId: string) {
  return createDataStreamResponse({
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
    },
    execute: (dataStream) => {
      const textStream = new ReadableStream({
        start(controller) {
          controller.enqueue(formatDataStreamPart("text", text));
          controller.close();
        },
      });
      dataStream.merge(textStream);
      dataStream.writeMessageAnnotation({
        id: messageId,
      });
    },
  });
}

export function OPTIONS() {
  return corsOptions();
}

export async function POST(request: Request) {
  const { message, conversationSlug, readPageTool }: ChatRequestBody = await request.json();

  const authResult = await authenticateWidget(request);
  if (!authResult.success) {
    return corsResponse({ error: authResult.error }, { status: 401 });
  }

  const { session, mailbox } = authResult;
  const conversation = await getConversation(conversationSlug, session, mailbox);
  const previousMessages = await loadPreviousMessages(conversation.id);
  const messages = appendClientMessage({
    messages: previousMessages,
    message,
  });

  if (conversation.subject === CHAT_CONVERSATION_SUBJECT && messages.length > 1 && message) {
    waitUntil(generateConversationSubject(conversation.id, messages, mailbox));
  }

  const userEmail = session.isAnonymous ? null : session.email || null;
  const userMessage = await createUserMessage(conversation.id, userEmail, message.content);

  let platformCustomer = null;
  if (!session.isAnonymous && session.email) {
    platformCustomer = await getPlatformCustomer(mailbox.id, session.email);
  }

  const isPromptConversation = conversation.source === "chat#prompt";
  const isFirstMessage = messages.length === 1;

  if (
    (await disableAIResponse(conversation.id, mailbox, platformCustomer)) &&
    (!isPromptConversation || !isFirstMessage)
  ) {
    await updateConversation(conversation.id, { set: { status: "open" } });
    if (
      messages.length === 1 ||
      (isPromptConversation && messages.filter((message) => message.role === "user").length === 2)
    ) {
      const message = "Our support team will respond to your message shortly. Thank you for your patience.";
      const assistantMessage = await createAssistantMessage(conversation.id, userMessage.id, message);
      return createTextResponse(message, assistantMessage.id.toString());
    }
    return createTextResponse("", Date.now().toString());
  }

  // Check if we have a cached response, if it's the first message
  const cacheKey = `chat:v2:mailbox-${mailbox.id}:initial-response:${hashQuery(message.content)}`;

  if (isFirstMessage && isPromptConversation) {
    const cached: string | null = await redis.get(cacheKey);
    if (cached != null) {
      const assistantMessage = await createAssistantMessage(conversation.id, userMessage.id, cached);
      return createTextResponse(cached, assistantMessage.id.toString());
    }
  }

  // Only fail if we're about to generate an AI response since only AI resolutions are billed
  if ((await getCachedSubscriptionStatus(mailbox.clerkOrganizationId)) === "free_trial_expired") {
    return createTextResponse("Free trial expired. Please upgrade to continue using Helper.", Date.now().toString());
  }

  const screenshotInvocation = messages
    .at(-1)
    ?.toolInvocations?.find((invocation: any) => invocation.toolName === "take_screenshot");

  if (screenshotInvocation?.state === "result") {
    if (screenshotInvocation.result.data) {
      const assistantMessage = assertDefined(await lastAssistantMessage(conversation.id));
      const base64Data = screenshotInvocation.result.data.split(",")[1];

      await createAndUploadFile({
        data: Buffer.from(base64Data, "base64"),
        fileName: `screenshot-${Date.now()}.png`,
        prefix: `screenshots/${conversationSlug}`,
        messageId: assistantMessage.id,
      });

      messages.push({
        role: "user",
        content: "Here's the screenshot. Don't describe it, just use it to help respond to my previous message.",
        experimental_attachments: [
          {
            name: "screenshot.png",
            contentType: "image/png",
            url: screenshotInvocation.result.data,
          },
        ],
        id: `${assistantMessage.id}-screenshot`,
      });
    } else {
      messages.push({
        role: "user",
        content: "I couldn't take a screenshot for you.",
        id: `${userMessage.id}-screenshot`,
      });
    }
  }

  return createDataStreamResponse({
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
    },
    execute: async (dataStream) => {
      const result = await generateAIResponse({
        messages,
        mailbox,
        conversationId: conversation.id,
        email: userEmail,
        readPageTool,
        addReasoning: true,
        dataStream,
        async onFinish({ text, finishReason, steps, traceId, experimental_providerMetadata }) {
          const hasSensitiveToolCall = steps.some((step: any) =>
            step.toolCalls.some((toolCall: any) => toolCall.toolName.includes("fetch_user_information")),
          );

          const hasRequestHumanSupportCall = steps.some((step: any) =>
            step.toolCalls.some((toolCall: any) => toolCall.toolName === "request_human_support"),
          );

          if (finishReason !== "stop" && finishReason !== "tool-calls") return;

          const reasoning = experimental_providerMetadata?.reasoning;
          const responseText = hasRequestHumanSupportCall
            ? "_Escalated to a human! You will be contacted soon by email._"
            : text;
          const assistantMessage = await createAssistantMessage(
            conversation.id,
            userMessage.id,
            responseText,
            traceId,
            reasoning,
          );
          await inngest.send({
            name: "conversations/check-resolution",
            data: {
              conversationId: conversation.id,
              messageId: assistantMessage.id,
            },
          });

          dataStream.writeMessageAnnotation({
            id: assistantMessage.id.toString(),
            traceId,
          });

          if (finishReason === "stop" && isFirstMessage && !hasSensitiveToolCall && !hasRequestHumanSupportCall) {
            await redis.set(cacheKey, responseText, { ex: 60 * 60 * 24 });
          }

          if (hasRequestHumanSupportCall) {
            waitUntil(
              generateConversationSubject(
                conversation.id,
                [...messages, { role: "assistant", content: text, id: assistantMessage.id.toString() }],
                mailbox,
              ),
            );
          }
        },
      });

      // consume the stream to ensure it runs to completion & triggers onFinish
      // even when the client response is aborted
      result.consumeStream();

      result.mergeIntoDataStream(dataStream);
    },
    onError(error) {
      captureExceptionAndLogIfDevelopment(error);
      return "Error generating AI response";
    },
  });
}
