import { and, desc, eq, gte, inArray, isNotNull, lt } from "drizzle-orm";
import { db } from "@/db/client";
import { conversationEvents, conversationMessages, conversations, mailboxes, platformCustomers } from "@/db/schema";
import { Mailbox } from "@/lib/data/mailbox";
import { determineVipStatus } from "@/lib/data/platformCustomer";

type DashboardEventPayload = {
  type: "email" | "chat" | "ai_reply" | "human_support_request" | "good_reply" | "bad_reply";
  id: string;
  conversationSlug: string;
  emailFrom: string | null;
  title: string | null;
  value: number | null;
  isVip: boolean;
  description?: string | null;
  timestamp: Date;
};

type ConversationForEvent = Pick<typeof conversations.$inferSelect, "slug" | "emailFrom" | "subject"> & {
  platformCustomer: Pick<typeof platformCustomers.$inferSelect, "value"> | null;
};

type BaseEventInput = {
  conversation: ConversationForEvent;
  mailbox: Pick<typeof mailboxes.$inferSelect, "vipThreshold">;
};

const createBaseEventPayload = ({
  conversation,
  mailbox,
}: BaseEventInput): Omit<DashboardEventPayload, "type" | "id" | "description" | "timestamp"> => {
  const value = conversation.platformCustomer?.value ? Number(conversation.platformCustomer.value) : null;
  return {
    conversationSlug: conversation.slug,
    emailFrom: conversation.emailFrom,
    title: conversation.subject,
    value,
    isVip: determineVipStatus(value, mailbox.vipThreshold),
  };
};

export const createMessageEventPayload = (
  message: Pick<typeof conversationMessages.$inferSelect, "id" | "role" | "emailTo" | "cleanedUpText" | "createdAt"> & {
    conversation: ConversationForEvent;
  },
  mailbox: Pick<typeof mailboxes.$inferSelect, "vipThreshold">,
): DashboardEventPayload => {
  return {
    ...createBaseEventPayload({ conversation: message.conversation, mailbox }),
    type: message.role === "ai_assistant" ? "ai_reply" : message.emailTo ? "email" : "chat",
    id: `${message.id}-message`,
    description: message.cleanedUpText,
    timestamp: message.createdAt,
  };
};

export const createReactionEventPayload = (
  message: Pick<
    typeof conversationMessages.$inferSelect,
    "id" | "reactionType" | "reactionFeedback" | "reactionCreatedAt"
  > & {
    conversation: ConversationForEvent;
  },
  mailbox: Pick<typeof mailboxes.$inferSelect, "vipThreshold">,
): DashboardEventPayload => {
  return {
    ...createBaseEventPayload({ conversation: message.conversation, mailbox }),
    type: message.reactionType === "thumbs-up" ? "good_reply" : "bad_reply",
    id: `${message.id}-reaction`,
    description: message.reactionFeedback,
    timestamp: message.reactionCreatedAt!,
  };
};

export const createHumanSupportRequestEventPayload = (
  request: Pick<typeof conversationEvents.$inferSelect, "id" | "createdAt"> & {
    conversation: ConversationForEvent;
  },
  mailbox: Pick<typeof mailboxes.$inferSelect, "vipThreshold">,
): DashboardEventPayload => {
  return {
    ...createBaseEventPayload({ conversation: request.conversation, mailbox }),
    type: "human_support_request",
    id: `${request.id}-human-support-request`,
    timestamp: request.createdAt,
  };
};

export const getLatestEvents = async (mailbox: Mailbox, before?: Date) => {
  const messages = await db.query.conversationMessages.findMany({
    columns: {
      id: true,
      createdAt: true,
      role: true,
      clerkUserId: true,
      cleanedUpText: true,
      emailTo: true,
    },
    with: {
      conversation: {
        columns: { subject: true, emailFrom: true, slug: true },
        with: {
          platformCustomer: { columns: { value: true } },
        },
      },
    },
    where: and(
      inArray(
        conversationMessages.conversationId,
        db.select({ id: conversations.id }).from(conversations).where(eq(conversations.mailboxId, mailbox.id)),
      ),
      inArray(conversationMessages.role, ["user", "staff", "ai_assistant"]),
      before ? lt(conversationMessages.createdAt, before) : undefined,
    ),
    orderBy: desc(conversationMessages.createdAt),
    limit: 20,
  });

  if (messages.length === 0) return [];

  const earliestMessageTimestamp = new Date(Math.min(...messages.map((message) => message.createdAt.getTime())));

  const messageEvents = messages.map((message) => createMessageEventPayload(message, mailbox));

  const reactions = await db.query.conversationMessages.findMany({
    columns: {
      id: true,
      reactionType: true,
      reactionFeedback: true,
      reactionCreatedAt: true,
    },
    with: {
      conversation: {
        columns: { subject: true, emailFrom: true, slug: true },
        with: {
          platformCustomer: { columns: { value: true } },
        },
      },
    },
    where: and(
      inArray(
        conversationMessages.conversationId,
        db.select({ id: conversations.id }).from(conversations).where(eq(conversations.mailboxId, mailbox.id)),
      ),
      isNotNull(conversationMessages.reactionType),
      isNotNull(conversationMessages.reactionCreatedAt),
      gte(conversationMessages.reactionCreatedAt, earliestMessageTimestamp),
      before ? lt(conversationMessages.reactionCreatedAt, before) : undefined,
    ),
    orderBy: desc(conversationMessages.reactionCreatedAt),
    limit: 20,
  });

  const reactionEvents = reactions.map((message) => createReactionEventPayload(message, mailbox));

  const humanSupportRequests = await db.query.conversationEvents.findMany({
    where: and(
      inArray(
        conversationEvents.conversationId,
        db.select({ id: conversations.id }).from(conversations).where(eq(conversations.mailboxId, mailbox.id)),
      ),
      eq(conversationEvents.type, "request_human_support"),
      gte(conversationEvents.createdAt, earliestMessageTimestamp),
      before ? lt(conversationEvents.createdAt, before) : undefined,
    ),
    with: {
      conversation: {
        columns: { subject: true, emailFrom: true, slug: true },
        with: {
          platformCustomer: { columns: { value: true } },
        },
      },
    },
    orderBy: desc(conversationEvents.createdAt),
    limit: 20,
  });

  const humanSupportRequestEvents = humanSupportRequests.map((request) =>
    createHumanSupportRequestEventPayload(request, mailbox),
  );

  return [...messageEvents, ...reactionEvents, ...humanSupportRequestEvents].toSorted(
    (a, b) => b.timestamp.getTime() - a.timestamp.getTime(),
  );
};
