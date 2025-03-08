import "server-only";
import { and, asc, desc, eq, exists, gt, ilike, inArray, isNotNull, isNull, lt, or, sql } from "drizzle-orm";
import { z } from "zod";
import { DEFAULT_CONVERSATIONS_PER_PAGE } from "@/components/constants";
import { db } from "@/db/client";
import {
  conversationEvents,
  conversationMessages,
  conversations,
  conversationsTopics,
  mailboxes,
  platformCustomers,
  topics,
} from "@/db/schema";
import { serializeConversation } from "@/lib/data/conversation";
import { getMetadataApiByMailbox } from "@/lib/data/mailboxMetadataApi";
import { searchEmailsByKeywords } from "../../emailSearchService/searchEmailsByKeywords";

export const searchSchema = z.object({
  cursor: z.string().nullish(),
  limit: z.number().min(1).max(100).default(DEFAULT_CONVERSATIONS_PER_PAGE),
  sort: z.enum(["newest", "oldest", "highest_value"]).catch("oldest").nullish(),
  category: z.enum(["conversations", "assigned", "mine", "unassigned"]).catch("conversations").nullish(),
  search: z.string().nullish(),
  status: z.array(z.enum(["open", "closed", "spam"]).catch("open")).nullish(),
  assignee: z.array(z.string()).optional(),
  createdAfter: z.string().datetime().optional(),
  createdBefore: z.string().datetime().optional(),
  repliedBy: z.array(z.string()).optional(),
  customer: z.array(z.string()).optional(),
  topic: z.array(z.number()).optional(),
  isVip: z.boolean().optional(),
  reactionType: z.enum(["thumbs-up", "thumbs-down"]).optional(),
  events: z.array(z.enum(["request_human_support", "resolved_by_ai"])).optional(),
});

export const searchConversations = async (
  mailbox: typeof mailboxes.$inferSelect,
  filters: z.infer<typeof searchSchema>,
  currentUserId: string,
) => {
  if (filters.category && !filters.search && !filters.status?.length) {
    filters.status = ["open"];
  }
  if (filters.category === "mine") {
    filters.assignee = [currentUserId];
  }
  if (filters.category === "unassigned") {
    filters.assignee = [];
  }

  const matches = filters.search ? await searchEmailsByKeywords(filters.search, mailbox.id) : [];

  const where = {
    mailboxId: eq(conversations.mailboxId, mailbox.id),
    ...(filters.status?.length ? { status: inArray(conversations.status, filters.status) } : {}),
    ...(filters.assignee?.length ? { assignee: inArray(conversations.assignedToClerkId, filters.assignee) } : {}),
    ...(filters.category === "assigned" ? { assignee: isNotNull(conversations.assignedToClerkId) } : {}),
    ...(filters.category === "unassigned" ? { assignee: isNull(conversations.assignedToClerkId) } : {}),
    ...(filters.isVip && mailbox.vipThreshold
      ? { isVip: sql`${platformCustomers.value} >= ${mailbox.vipThreshold * 100}` }
      : {}),
    ...(filters.createdAfter ? { createdAfter: gt(conversations.createdAt, new Date(filters.createdAfter)) } : {}),
    ...(filters.createdBefore ? { createdBefore: lt(conversations.createdAt, new Date(filters.createdBefore)) } : {}),
    ...(filters.repliedBy?.length
      ? {
          repliedBy: exists(
            db
              .select()
              .from(conversationMessages)
              .where(
                and(
                  eq(conversationMessages.conversationId, conversations.id),
                  inArray(conversationMessages.clerkUserId, filters.repliedBy),
                ),
              ),
          ),
        }
      : {}),
    ...(filters.customer?.length ? { customer: inArray(conversations.emailFrom, filters.customer) } : {}),
    ...(filters.topic?.length
      ? {
          topic: exists(
            db
              .select()
              .from(conversationsTopics)
              .leftJoin(topics, eq(conversationsTopics.subTopicId, topics.id))
              .where(and(eq(conversationsTopics.conversationId, conversations.id), inArray(topics.id, filters.topic))),
          ),
        }
      : {}),
    ...(filters.reactionType
      ? {
          reaction: exists(
            db
              .select()
              .from(conversationMessages)
              .where(
                and(
                  eq(conversationMessages.conversationId, conversations.id),
                  eq(conversationMessages.reactionType, filters.reactionType),
                  isNull(conversationMessages.deletedAt),
                ),
              ),
          ),
        }
      : {}),
    ...(filters.events?.length
      ? {
          events: exists(
            db
              .select()
              .from(conversationEvents)
              .where(
                and(
                  eq(conversationEvents.conversationId, conversations.id),
                  inArray(conversationEvents.type, filters.events),
                ),
              ),
          ),
        }
      : {}),
    ...(filters.search
      ? {
          search: or(
            ilike(conversations.emailFrom, `%${filters.search}%`),
            inArray(
              conversations.id,
              matches.map((m) => m.conversationId),
            ),
          ),
        }
      : {}),
  };

  const orderByField =
    filters.status?.length === 1 && filters.status[0] === "closed"
      ? conversations.closedAt
      : conversations.lastUserEmailCreatedAt;
  const orderBy = [filters.sort === "newest" ? desc(orderByField) : asc(orderByField)];
  const metadataEnabled = !filters.search && !!(await getMetadataApiByMailbox(mailbox));
  if (metadataEnabled && (filters.sort === "highest_value" || !filters.sort)) {
    orderBy.unshift(sql`${platformCustomers.value} DESC NULLS LAST`);
  }

  const list = await db
    .select()
    .from(conversations)
    .leftJoin(
      platformCustomers,
      and(
        eq(conversations.mailboxId, platformCustomers.mailboxId),
        eq(conversations.emailFrom, platformCustomers.email),
      ),
    )
    .leftJoin(
      conversationMessages,
      and(
        eq(conversations.id, conversationMessages.conversationId),
        inArray(
          conversationMessages.id,
          matches.map((m) => m.id),
        ),
      ),
    )
    .where(and(...Object.values(where)))
    .orderBy(...orderBy)
    .limit(filters.limit + 1) // Get one extra to determine if there's a next page
    .offset(filters.cursor ? parseInt(filters.cursor) : 0)
    .then((results) => ({
      results: results
        .slice(0, filters.limit)
        .map(({ conversations_conversation, mailboxes_platformcustomer, messages }) => ({
          ...serializeConversation(mailbox, conversations_conversation, mailboxes_platformcustomer),
          matchedMessageText: messages?.cleanedUpText ?? null,
        })),
      nextCursor: results.length > filters.limit ? (parseInt(filters.cursor ?? "0") + filters.limit).toString() : null,
    }));

  return {
    list,
    where,
    metadataEnabled,
  };
};
