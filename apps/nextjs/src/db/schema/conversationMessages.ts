import { isNull, relations, sql } from "drizzle-orm";
import { bigint, boolean, index, jsonb, pgTable, text, timestamp, varchar } from "drizzle-orm/pg-core";
import { encryptedField } from "@/db/lib/encryptedField";
import { PromptInfo } from "@/types/conversationMessages";
import { CustomerInfo } from "@/types/customerInfo";
import { withTimestamps } from "../lib/with-timestamps";
import { conversations } from "./conversations";
import { files } from "./files";
import { messageNotifications } from "./messageNotifications";
import { workflowRuns } from "./workflowRuns";

export type ToolMetadata = {
  tool: {
    id: number;
    slug: string;
    name: string;
    description: string;
    url: string;
    requestMethod: string;
  };
  result: any;
  success: boolean;
  parameters: Record<string, unknown>;
};

type MessageStatus = "queueing" | "sent" | "failed" | "draft" | "discarded";
export type MessageRole = "user" | "staff" | "ai_assistant" | "workflow" | "tool";
type MessageMetadata<T extends MessageRole> = T extends "tool"
  ? ToolMetadata
  : Partial<CustomerInfo> & Record<string, unknown> & { reasoning?: string | null };

export const DRAFT_STATUSES: Partial<MessageStatus>[] = ["draft", "discarded"];

export const conversationMessages = pgTable(
  "messages",
  {
    ...withTimestamps,
    id: bigint({ mode: "number" }).primaryKey().generatedByDefaultAsIdentity(),
    conversationId: bigint({ mode: "number" }).notNull(),
    emailTo: varchar({ length: 65535 }),
    emailFrom: text(),
    emailCc: jsonb().$type<string[]>(),
    emailBcc: jsonb().$type<string[]>(),
    body: encryptedField(),
    cleanedUpText: encryptedField(),
    role: text().notNull().$type<MessageRole>(),
    clerkUserId: text(),
    metadata: jsonb().$type<MessageMetadata<MessageRole>>(),
    responseToId: bigint({ mode: "number" }),
    status: text().$type<MessageStatus>(),
    messageId: text(),
    references: text(),
    gmailMessageId: text(),
    gmailThreadId: text(),
    isPinned: boolean()
      .notNull()
      .$defaultFn(() => false),
    slackChannel: text(),
    slackMessageTs: text(),
    isPerfect: boolean().notNull(),

    // These columns were replaced by promptInfo; they haven't been dropped
    // in case we want to migrate the data into promptInfo at some point.
    docsContext: text(),
    pastRepliesContext: text(),

    isFlaggedAsBad: boolean().notNull(),
    promptInfo: jsonb().$type<PromptInfo>(),
    reason: varchar({ length: 65535 }),
    deletedAt: timestamp({ withTimezone: true }),
    searchIndex: text(),

    // For message reactions
    reactionType: text().$type<"thumbs-up" | "thumbs-down">(),
    reactionFeedback: text(),
    reactionCreatedAt: timestamp({ withTimezone: true }),
  },
  (table) => {
    return {
      createdAtIdx: index("conversatio_created_c4e0d1_idx").on(table.createdAt.asc().nullsLast()),
      conversationIdIdx: index("conversations_email_conversation_id_391ad973").on(
        table.conversationId.asc().nullsLast(),
      ),
      gmailMessageIdIdx: index("conversations_email_gmail_message_id_3f6ee5ab").on(
        table.gmailMessageId.asc().nullsLast(),
      ),
      gmailThreadIdIdx: index("conversations_email_gmail_thread_id_68f031bf").on(table.gmailThreadId.asc().nullsLast()),
      isPinnedIdx: index("conversations_email_is_pinned_ab83d24f").on(table.isPinned.asc().nullsLast()),
      messageIdIdx: index("conversations_email_message_id_a19e9ac9").on(table.messageId.asc().nullsLast()),
      responseToIdIdx: index("conversations_email_response_to_id_af0048dc").on(table.responseToId.asc().nullsLast()),
      clerkUserIdIdx: index("conversations_email_clerk_user_id").on(table.clerkUserId.asc().nullsLast()),
      searchIndexIdx: index("search_index_idx").using("gin", sql`string_to_array(${table.searchIndex}, ' ') array_ops`),
      reasonIdx: index("messages_reason_idx").using("btree", table.reason).concurrently(),
      slackMessageTsIdx: index("messages_slack_message_ts_idx").using("btree", table.slackMessageTs).concurrently(),
      reactionCountIdx: index("messages_reaction_count_idx")
        .on(table.reactionType, table.reactionCreatedAt)
        .where(isNull(table.deletedAt))
        .concurrently(),
    };
  },
);

export const conversationMessageRelations = relations(conversationMessages, ({ one, many }) => ({
  conversation: one(conversations, {
    fields: [conversationMessages.conversationId],
    references: [conversations.id],
  }),
  files: many(files),
  workflowRuns: many(workflowRuns),
  notifications: many(messageNotifications),
}));
