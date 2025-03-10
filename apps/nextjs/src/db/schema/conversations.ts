import { relations } from "drizzle-orm";
import { bigint, index, integer, jsonb, pgTable, text, timestamp, unique, vector } from "drizzle-orm/pg-core";
import { mailboxes } from "@/db/schema/mailboxes";
import { nativeEncryptedField } from "../lib/encryptedField";
import { randomSlugField } from "../lib/random-slug-field";
import { withTimestamps } from "../lib/with-timestamps";
import { conversationEvents } from "./conversationEvents";
import { conversationMessages } from "./conversationMessages";
import { platformCustomers } from "./platformCustomers";

export const conversations = pgTable(
  "conversations_conversation",
  {
    ...withTimestamps,
    id: bigint({ mode: "number" }).primaryKey().generatedByDefaultAsIdentity(),
    emailFrom: text(),
    subject: nativeEncryptedField("encrypted_subject"),
    status: text().$type<"open" | "closed" | "spam">(),
    mailboxId: bigint({ mode: "number" }).notNull(),
    emailFromName: text(),
    slug: randomSlugField("slug"),
    lastUserEmailCreatedAt: timestamp({ withTimezone: true, mode: "date" }),
    conversationProvider: text().$type<"gmail" | "helpscout" | "chat">(),
    closedAt: timestamp({ withTimezone: true, mode: "date" }),
    assignedToId: integer(),
    assignedToClerkId: text(),
    summary: jsonb().$type<string[]>(),
    embedding: vector({ dimensions: 1536 }),
    embeddingText: text(),
    source: text().$type<"email" | "chat" | "chat#prompt">(),
    githubIssueNumber: integer(),
    githubIssueUrl: text(),
    githubRepoOwner: text(),
    githubRepoName: text(),
  },
  (table) => {
    return {
      assignedToIdIdx: index("conversations_conversation_assigned_to_id_327a1b36").on(table.assignedToId),
      assignedToClerkIdIdx: index("conversations_conversation_assigned_to_clerk_id").on(table.assignedToClerkId),
      closedAtIdx: index("conversations_conversation_closed_at_16474e94").on(table.closedAt),
      createdAtIdx: index("conversations_conversation_created_at_1ec48787").on(table.createdAt),
      emailFromIdx: index("conversations_conversation_email_from_aab3d292").on(table.emailFrom),
      // Drizzle doesn't generate migrations with `text_pattern_ops`; they only have `text_ops`
      emailFromLikeIdx: index("conversations_conversation_email_from_aab3d292_like").on(table.emailFrom),
      lastUserEmailCreatedAtIdx: index("conversations_conversation_last_user_email_created_at_fc6b89db").on(
        table.lastUserEmailCreatedAt,
      ),
      mailboxIdIdx: index("conversations_conversation_mailbox_id_7fb25662").on(table.mailboxId),
      // Drizzle doesn't generate migrations with `text_pattern_ops`; they only have `text_ops`
      slugLikeIdx: index("conversations_conversation_slug_9924e9b1_like").on(table.slug),
      statusIdx: index("conversations_conversation_status_c5b08f82").on(table.status),
      embeddingVectorIdx: index("embedding_vector_index").using(
        "hnsw",
        table.embedding.asc().nullsLast().op("vector_cosine_ops"),
      ),
      slugUnique: unique("conversations_conversation_slug_key").on(table.slug),
    };
  },
);

export const conversationsRelations = relations(conversations, ({ one, many }) => ({
  mailbox: one(mailboxes, {
    fields: [conversations.mailboxId],
    references: [mailboxes.id],
  }),
  messages: many(conversationMessages),
  platformCustomer: one(platformCustomers, {
    fields: [conversations.emailFrom],
    references: [platformCustomers.email],
  }),
  events: many(conversationEvents),
}));
