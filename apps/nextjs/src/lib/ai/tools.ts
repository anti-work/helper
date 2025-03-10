import { waitUntil } from "@vercel/functions";
import { CoreMessage, tool, type Tool } from "ai";
import { z } from "zod";
import { assertDefined } from "@/components/utils/assert";
import { inngest } from "@/inngest/client";
import { REQUEST_HUMAN_SUPPORT_DESCRIPTION } from "@/lib/ai/constants";
import { getConversationById, updateConversation } from "@/lib/data/conversation";
import { Mailbox } from "@/lib/data/mailbox";
import { getMetadataApiByMailbox } from "@/lib/data/mailboxMetadataApi";
import { upsertPlatformCustomer } from "@/lib/data/platformCustomer";
import { fetchMetadata, getPastConversationsPrompt } from "@/lib/data/retrieval";
import { getMailboxToolsForChat } from "@/lib/data/tools";
import { captureExceptionAndLogIfDevelopment } from "@/lib/shared/sentry";
import { buildAITools, callToolApi } from "@/lib/tools/apiTool";

const fetchUserInformation = async (email: string, mailboxSlug: string, reason: string) => {
  try {
    const metadata = await fetchMetadata(email, mailboxSlug);
    return metadata?.prompt;
  } catch (error) {
    captureExceptionAndLogIfDevelopment(error, {
      extra: { email, mailboxSlug },
    });
    return "Error fetching metadata";
  }
};

const searchKnowledgeBase = async (query: string, mailbox: Mailbox) => {
  const documents = await getPastConversationsPrompt(query, mailbox);
  return documents ?? "No past conversations found";
};

const updateCustomerMetadata = async (email: string, mailboxId: number, mailboxSlug: string) => {
  try {
    const customerMetadata = (await fetchMetadata(email, mailboxSlug))?.metadata ?? null;
    if (customerMetadata) {
      await upsertPlatformCustomer({
        email,
        mailboxId,
        customerMetadata,
      });
    }
  } catch (error) {
    captureExceptionAndLogIfDevelopment(error, {
      extra: { email, mailboxId },
    });
  }
};

const requestHumanSupport = async (
  conversationId: number,
  email: string | null,
  mailbox: Mailbox,
  reason: string,
  newEmail?: string,
) => {
  const conversation = assertDefined(await getConversationById(conversationId));

  if (newEmail) {
    await updateConversation(conversation.id, {
      set: { emailFrom: newEmail },
      message: "Email set for escalation",
      type: "update",
    });
    email = newEmail;
  }

  await updateConversation(conversation.id, {
    set: { status: "open" },
    message: reason,
    type: "request_human_support",
  });

  if (email) {
    waitUntil(updateCustomerMetadata(email, conversation.mailboxId, mailbox.slug));

    waitUntil(
      inngest.send({
        name: "conversations/human-support-requested",
        data: {
          mailboxSlug: mailbox.slug,
          conversationId: conversation.id,
        },
      }),
    );
  }

  return "The conversation has been escalated to a human agent. You will be contacted soon by email.";
};

const setUserEmail = async (conversationId: number, email: string) => {
  const conversation = assertDefined(await getConversationById(conversationId));
  await updateConversation(conversation.id, {
    set: { emailFrom: email },
    message: "Email set by user",
    type: "update",
  });

  return "Your email has been set. You can now request human support if needed.";
};

export const buildTools = async (
  conversationId: number,
  email: string | null,
  mailbox: Mailbox,
  includeHumanSupport = true,
  includeMailboxTools = true,
  reasoningMiddlewarePrompt?: string,
): Promise<Record<string, Tool>> => {
  const metadataApi = await getMetadataApiByMailbox(mailbox);

  const reasoningMiddleware = async (
    result: Promise<string | undefined> | string | undefined,
    messages: CoreMessage[],
  ) => {
    const resultString = await result;
    if (reasoningMiddlewarePrompt && resultString) {
      return `${reasoningMiddlewarePrompt}\n\n${resultString}`;
    }
    return resultString;
  };

  const tools: Record<string, Tool> = {
    knowledge_base: tool({
      description: "search the knowledge base",
      parameters: z.object({
        query: z.string().describe("query to search the knowledge base"),
      }),
      execute: ({ query }, { messages }) => reasoningMiddleware(searchKnowledgeBase(query, mailbox), messages),
    }),
  };

  if (!email) {
    tools.set_user_email = tool({
      description: "Set the email address for the current anonymous user, so that the user can be contacted later",
      parameters: z.object({
        email: z.string().email().describe("email address to set for the user"),
      }),
      execute: ({ email }, { messages }) => reasoningMiddleware(setUserEmail(conversationId, email), messages),
    });
  }

  if (includeHumanSupport) {
    tools.request_human_support = tool({
      description: REQUEST_HUMAN_SUPPORT_DESCRIPTION,
      parameters: z.object({
        reason: z.string().describe("reason for escalation"),
        email: email
          ? z.string().optional()
          : z.string().email().describe("email address to contact you (required for anonymous users)"),
      }),
      execute: ({ reason, email: newEmail }, { messages }) =>
        reasoningMiddleware(requestHumanSupport(conversationId, email, mailbox, reason, newEmail), messages),
    });
  }

  if (metadataApi && email) {
    tools.fetch_user_information = tool({
      description: "fetch user related information",
      parameters: z.object({
        reason: z.string().describe("reason for fetching user information"),
      }),
      execute: ({ reason }, { messages }) =>
        reasoningMiddleware(fetchUserInformation(email, mailbox.slug, reason), messages),
    });
  }

  if (includeMailboxTools) {
    const mailboxTools = await getMailboxToolsForChat(mailbox);
    const aiTools = buildAITools(mailboxTools);

    for (const [slug, aiTool] of Object.entries(aiTools)) {
      const mailboxTool = mailboxTools.find((t) => t.slug === slug);
      if (!mailboxTool) continue;

      tools[slug] = tool({
        description: aiTool.description,
        parameters: aiTool.parameters,
        execute: async (params, { messages }) => {
          const conversation = assertDefined(await getConversationById(conversationId));
          const result = await callToolApi(conversation, mailboxTool, params);
          return reasoningMiddleware(JSON.stringify(result), messages);
        },
      });
    }
  }

  return tools;
};
