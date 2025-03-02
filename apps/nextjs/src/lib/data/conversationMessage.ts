import { User } from "@clerk/nextjs/server";
import { addSeconds } from "date-fns";
import { and, asc, desc, eq, isNotNull, isNull, ne, notInArray, or } from "drizzle-orm";
import { htmlToText } from "html-to-text";
import DOMPurify from "isomorphic-dompurify";
import { EMAIL_UNDO_COUNTDOWN_SECONDS } from "@/components/constants";
import { takeUniqueOrThrow } from "@/components/utils/arrays";
import { db, Transaction } from "@/db/client";
import { conversationMessages, DRAFT_STATUSES, files, mailboxes, workflowRuns } from "@/db/schema";
import { conversationEvents } from "@/db/schema/conversationEvents";
import { notes } from "@/db/schema/notes";
import type { Tool } from "@/db/schema/tools";
import { inngest } from "@/inngest/client";
import { getActiveEscalation, resolveEscalation } from "@/lib/data/escalation";
import { PlatformCustomer } from "@/lib/data/platformCustomer";
import { getWorkflowInfo } from "@/lib/data/workflow";
import { proxyExternalContent } from "@/lib/proxyExternalContent";
import { getSlackPermalink } from "@/lib/slack/client";
import { createPresignedDownloadUrl } from "@/s3/utils";
import { PromptInfo } from "@/types/conversationMessages";
import { formatBytes } from "../files";
import { getConversationById, getNonSupportParticipants, updateConversation } from "./conversation";
import { finishFileUpload } from "./files";
import { getClerkUserList } from "./user";

const isAiDraftStale = (draft: typeof conversationMessages.$inferSelect, mailbox: typeof mailboxes.$inferSelect) => {
  return draft.status !== "draft" || draft.createdAt < mailbox.promptUpdatedAt;
};

export const serializeResponseAiDraft = (
  draft: typeof conversationMessages.$inferSelect,
  mailbox: typeof mailboxes.$inferSelect,
  user?: User,
) => {
  if (!draft?.responseToId) {
    return null;
  }
  return {
    id: draft.id,
    responseToId: draft.responseToId,
    body: bodyWithSignature(draft.body, user),
    isStale: isAiDraftStale(draft, mailbox),
  };
};

export const bodyWithSignature = (body?: string | null, user?: User) => {
  if (body && user?.firstName) {
    return `${body}<br><br>Best,<br>${user?.firstName}`;
  }
  return body ?? "";
};

export const getMessages = async (conversationId: number, mailbox: typeof mailboxes.$inferSelect) => {
  const messages = await db.query.conversationMessages.findMany({
    where: and(
      eq(conversationMessages.conversationId, conversationId),
      isNull(conversationMessages.deletedAt),
      or(eq(conversationMessages.role, "user"), notInArray(conversationMessages.status, DRAFT_STATUSES)),
    ),
    columns: {
      id: true,
      status: true,
      body: true,
      createdAt: true,
      emailTo: true,
      emailCc: true,
      emailBcc: true,
      clerkUserId: true,
      emailFrom: true,
      isPinned: true,
      role: true,
      conversationId: true,
      metadata: true,
      slackChannel: true,
      slackMessageTs: true,
      reactionType: true,
      reactionFeedback: true,
      reactionCreatedAt: true,
      isFlaggedAsBad: true,
      reason: true,
    },
    with: {
      files: {
        where: eq(files.isPublic, false),
      },
    },
  });

  const noteRecords = await db.query.notes.findMany({
    where: eq(notes.conversationId, conversationId),
    columns: {
      id: true,
      createdAt: true,
      body: true,
      role: true,
      slackChannel: true,
      slackMessageTs: true,
      clerkUserId: true,
    },
    with: {
      files: true,
    },
  });

  const eventRecords = await db.query.conversationEvents.findMany({
    where: and(eq(conversationEvents.conversationId, conversationId), ne(conversationEvents.type, "reasoning_toggled")),
    columns: {
      id: true,
      createdAt: true,
      changes: true,
      byClerkUserId: true,
      reason: true,
    },
  });

  const membersById = Object.fromEntries(
    (await getClerkUserList(mailbox.clerkOrganizationId)).data.map((user) => [user.id, user]),
  );

  const workflowRunsData = await db.select().from(workflowRuns).where(eq(workflowRuns.conversationId, conversationId));
  const workflowRunsMap = new Map(workflowRunsData.map((wr) => [wr.messageId, wr]));

  const messageInfos = await Promise.all(
    messages.map((message) =>
      serializeMessage(
        message,
        mailbox,
        (message.clerkUserId && membersById[message.clerkUserId]) || null,
        workflowRunsMap,
      ),
    ),
  );

  const noteInfos = await Promise.all(
    noteRecords.map(async (note) => ({
      ...note,
      type: "note" as const,
      from: note.clerkUserId ? (membersById[note.clerkUserId]?.fullName ?? null) : null,
      slackUrl:
        mailbox.slackBotToken && note.slackChannel && note.slackMessageTs
          ? await getSlackPermalink(mailbox.slackBotToken, note.slackChannel, note.slackMessageTs)
          : null,
      files: (await serializeFiles(note.files)).flatMap((f) => (f.isInline ? [] : [f])),
    })),
  );

  const eventInfos = await Promise.all(
    eventRecords.map((event) => ({
      ...event,
      changes: {
        ...event.changes,
        assignedToUser: event.changes.assignedToClerkId
          ? (membersById[event.changes.assignedToClerkId]?.fullName ?? null)
          : event.changes.assignedToClerkId,
      },
      byUser: event.byClerkUserId ? (membersById[event.byClerkUserId]?.fullName ?? null) : null,
      type: "event" as const,
    })),
  );

  return [...messageInfos, ...noteInfos, ...eventInfos]
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
    .map((info) => ({ ...info, isNew: false }));
};

export const sanitizeBody = async (body: string | null) =>
  body ? await proxyExternalContent(DOMPurify.sanitize(body, { FORBID_TAGS: ["script", "style"] })) : null;

export const serializeMessage = async (
  message: Pick<
    typeof conversationMessages.$inferSelect,
    | "id"
    | "status"
    | "body"
    | "createdAt"
    | "emailTo"
    | "emailCc"
    | "emailBcc"
    | "clerkUserId"
    | "emailFrom"
    | "isPinned"
    | "role"
    | "conversationId"
    | "slackChannel"
    | "slackMessageTs"
    | "metadata"
    | "reactionType"
    | "reactionFeedback"
    | "reactionCreatedAt"
    | "isFlaggedAsBad"
    | "reason"
  > & {
    files?: (typeof files.$inferSelect)[];
  },
  mailbox: typeof mailboxes.$inferSelect,
  user: User | null,
  workflowRunsMap?: Map<number, typeof workflowRuns.$inferSelect>,
) => {
  const workflowRun = workflowRunsMap
    ? workflowRunsMap.get(message.id)
    : (await db.select().from(workflowRuns).where(eq(workflowRuns.messageId, message.id)))[0];

  const messageFiles =
    message.files ??
    (await db.query.files.findMany({ where: and(eq(files.messageId, message.id), eq(files.isPublic, false)) }));

  const draftEmail =
    message.role === "user"
      ? await db.query.conversationMessages.findFirst({
          where: and(
            eq(conversationMessages.conversationId, message.conversationId),
            eq(conversationMessages.role, "ai_assistant"),
            isNotNull(conversationMessages.promptInfo),
            eq(conversationMessages.responseToId, message.id),
          ),
          orderBy: [desc(conversationMessages.createdAt)],
        })
      : null;

  const workflowRunData = workflowRun ? await getWorkflowInfo(workflowRun) : null;

  const filesData = await serializeFiles(messageFiles);

  let sanitizedBody = await sanitizeBody(message.body);
  filesData.forEach((f) => {
    if (f.isInline && sanitizedBody) {
      sanitizedBody = sanitizedBody.replaceAll(`src="${f.url}"`, `src="${f.presignedUrl}"`);
    }
  });

  return {
    type: "message" as const,
    id: message.id,
    status: message.status,
    body: sanitizedBody,
    createdAt: message.createdAt,
    role: message.role,
    emailTo: message.emailTo,
    cc: message.emailCc || [],
    bcc: message.emailBcc || [],
    from: message.role === "staff" && user ? user.fullName : message.emailFrom,
    isPinned: message.isPinned ?? false,
    slackUrl:
      mailbox.slackBotToken && message.slackChannel && message.slackMessageTs
        ? await getSlackPermalink(mailbox.slackBotToken, message.slackChannel, message.slackMessageTs)
        : null,
    workflowRun: workflowRunData,
    draft: draftEmail ? serializeResponseAiDraft(draftEmail, mailbox) : null,
    files: filesData.flatMap((f) => (f.isInline ? [] : [f])),
    metadata: message.metadata,
    reactionType: message.reactionType,
    reactionFeedback: message.reactionFeedback,
    reactionCreatedAt: message.reactionCreatedAt,
    isFlaggedAsBad: message.isFlaggedAsBad,
    reason: message.reason,
  };
};

const serializeFiles = (inputFiles: (typeof files.$inferSelect)[]) =>
  Promise.all(
    inputFiles.map(async (file) =>
      file.isInline
        ? { isInline: true as const, url: file.url, presignedUrl: await createPresignedDownloadUrl(file.url) }
        : {
            ...file,
            isInline: false as const,
            sizeHuman: formatBytes(file.size, 2),
            presignedUrl: await createPresignedDownloadUrl(file.url),
            previewUrl: file.previewUrl ? await createPresignedDownloadUrl(file.previewUrl) : null,
          },
    ),
  );

type OptionalMessageAttributes = "updatedAt" | "createdAt";
type NewConversationMessage = Omit<typeof conversationMessages.$inferInsert, OptionalMessageAttributes> &
  Partial<Pick<typeof conversationMessages.$inferInsert, OptionalMessageAttributes>>;

export type ConversationMessage = typeof conversationMessages.$inferSelect;

export const createReply = async (
  {
    conversationId,
    message,
    user,
    cc,
    bcc = [],
    fileSlugs = [],
    close = true,
    slack,
    role,
    responseToId = null,
    shouldAutoAssign = true,
  }: {
    conversationId: number;
    message: string | null;
    user: User | null;
    cc?: string[] | null;
    bcc?: string[];
    fileSlugs?: string[];
    close?: boolean;
    slack?: { channel: string; messageTs: string } | null;
    role?: "user" | "staff" | "workflow" | null;
    responseToId?: number | null;
    shouldAutoAssign?: boolean;
  },
  tx0: Transaction | typeof db = db,
) => {
  const conversation = await getConversationById(conversationId);
  if (!conversation) throw new Error("Conversation not found");

  return tx0.transaction(async (tx) => {
    if (shouldAutoAssign && user && !conversation.assignedToClerkId) {
      await updateConversation(conversationId, { set: { assignedToClerkId: user.id }, byUserId: null }, tx);
    }

    const createdMessage = await createConversationMessage(
      {
        conversationId,
        body: message,
        clerkUserId: user?.id,
        emailCc: cc ?? (await getNonSupportParticipants(conversation)),
        emailBcc: bcc,
        slackChannel: slack?.channel,
        slackMessageTs: slack?.messageTs,
        role: role ?? "staff",
        responseToId,
        status: "queueing",
        isPerfect: false,
        isFlaggedAsBad: false,
      },
      tx,
    );

    await finishFileUpload({ fileSlugs, messageId: createdMessage.id }, tx);

    const escalation = await getActiveEscalation(conversationId, tx);
    if (escalation) {
      await resolveEscalation({ escalation, user, email: true, closed: close }, tx);
    }

    if (close && conversation.status !== "spam") {
      await updateConversation(conversationId, { set: { status: "closed" }, byUserId: user?.id ?? null }, tx);
    }

    const lastAiDraft = await getLastAiGeneratedDraft(conversationId, tx);
    if (lastAiDraft?.body) {
      const draftBody = user ? bodyWithSignature(lastAiDraft.body, user) : lastAiDraft.body;
      if (message && cleanupMessage(draftBody) === cleanupMessage(message)) {
        await tx
          .update(conversationMessages)
          .set({ isPerfect: true })
          .where(eq(conversationMessages.id, createdMessage.id));
      }
    }
    await discardAiGeneratedDrafts(conversationId, tx);

    return createdMessage.id;
  });
};

export const createConversationMessage = async (
  conversationMessage: NewConversationMessage,
  tx: Transaction | typeof db = db,
): Promise<typeof conversationMessages.$inferSelect> => {
  const message = await tx
    .insert(conversationMessages)
    .values({
      isPinned: false,
      ...conversationMessage,
    })
    .returning()
    .then(takeUniqueOrThrow);

  if (message.role === "user") {
    await updateConversation(
      message.conversationId,
      { set: { lastUserEmailCreatedAt: new Date() }, skipAblyEvents: true },
      tx,
    );
  }

  if (message.status !== "draft") {
    await inngest.send({
      name: "conversations/message.created",
      data: {
        messageId: message.id,
        conversationId: message.conversationId,
      },
    });
  }

  if (message.status === "queueing") {
    await inngest.send({
      name: "conversations/email.enqueued",
      data: { messageId: message.id },
      ts: addSeconds(new Date(), EMAIL_UNDO_COUNTDOWN_SECONDS).getTime(),
    });
  }

  return message;
};

export const createAiDraft = async (
  conversationId: number,
  body: string,
  responseToId: number,
  promptInfo: PromptInfo,
  tx: Transaction | typeof db = db,
): Promise<typeof conversationMessages.$inferSelect> => {
  if (!responseToId) {
    throw new Error("responseToId is required");
  }

  const validatedPromptInfo = validatePromptInfo(promptInfo);

  return await createConversationMessage(
    {
      conversationId,
      body: body.replace("\n", "<br>"),
      role: "ai_assistant",
      status: "draft",
      responseToId,
      promptInfo: validatedPromptInfo,
      cleanedUpText: body,
      isPerfect: false,
      isFlaggedAsBad: false,
    },
    tx,
  );
};

export const ensureCleanedUpText = async (
  message: typeof conversationMessages.$inferSelect,
  tx: Transaction | typeof db = db,
) => {
  if (message.cleanedUpText !== null) return message.cleanedUpText;
  const cleanedUpText = generateCleanedUpText(message.body ?? "");
  await tx.update(conversationMessages).set({ cleanedUpText }).where(eq(conversationMessages.id, message.id));
  return cleanedUpText;
};

export const getConversationMessageById = async (id: number): Promise<ConversationMessage | null> => {
  const result = await db.query.conversationMessages.findFirst({
    where: eq(conversationMessages.id, id),
  });
  return result ?? null;
};

export const getLastAiGeneratedDraft = async (
  conversationId: number,
  tx: Transaction | typeof db = db,
): Promise<typeof conversationMessages.$inferSelect | null> => {
  const result = await tx.query.conversationMessages.findFirst({
    where: and(
      eq(conversationMessages.conversationId, conversationId),
      eq(conversationMessages.role, "ai_assistant"),
      eq(conversationMessages.status, "draft"),
    ),
    orderBy: [desc(conversationMessages.createdAt)],
  });
  return result ?? null;
};

export async function getTextWithConversationSubject(
  conversation: { subject: string | null },
  message: typeof conversationMessages.$inferSelect,
) {
  const cleanedUpText = await ensureCleanedUpText(message);
  const subject = conversation.subject;
  return `${subject ? `${subject}\n\n` : ""}${cleanedUpText}`;
}

export const getPastMessages = async (
  message: typeof conversationMessages.$inferSelect,
): Promise<(typeof conversationMessages.$inferSelect)[]> => {
  const pastMessages = await db.query.conversationMessages.findMany({
    where: and(
      eq(conversationMessages.conversationId, message.conversationId),
      ne(conversationMessages.id, message.id),
      notInArray(conversationMessages.status, DRAFT_STATUSES),
      isNotNull(conversationMessages.body),
      isNotNull(conversationMessages.cleanedUpText),
    ),
    orderBy: [asc(conversationMessages.createdAt)],
  });

  for (const pastMessage of pastMessages) {
    if (pastMessage.cleanedUpText === null) {
      pastMessage.cleanedUpText = await ensureCleanedUpText(pastMessage);
    }
  }
  return pastMessages;
};

export const createToolEvent = async ({
  conversationId,
  tool,
  data,
  error,
  parameters,
  userMessage,
  tx = db,
}: {
  conversationId: number;
  tool: Tool;
  data?: any;
  error?: any;
  parameters: Record<string, any>;
  userMessage: string;
  tx?: Transaction | typeof db;
}) => {
  const message = await tx.insert(conversationMessages).values({
    conversationId,
    role: "tool",
    body: userMessage,
    cleanedUpText: userMessage,
    metadata: {
      tool: {
        id: tool.id,
        slug: tool.slug,
        name: tool.name,
        description: tool.description,
        url: tool.url,
        requestMethod: tool.requestMethod,
      },
      result: data || error,
      success: !error,
      parameters,
    },
    isPerfect: false,
    isFlaggedAsBad: false,
    status: "sent",
  });

  return message;
};

const discardAiGeneratedDrafts = async (conversationId: number, tx: Transaction | typeof db = db): Promise<void> => {
  await tx
    .update(conversationMessages)
    .set({ status: "discarded" })
    .where(
      and(
        eq(conversationMessages.conversationId, conversationId),
        eq(conversationMessages.role, "ai_assistant"),
        eq(conversationMessages.status, "draft"),
      ),
    );
};

const cleanupMessage = (message: string): string => {
  const strippedMessage = message.replace(/<[^>]*>/g, "");
  return strippedMessage.replace(/\s+/g, " ").trim();
};

const generateCleanedUpText = (html: string) => {
  if (!html.trim()) return "";

  const paragraphs = htmlToText(html)
    .split(/\s*\n\s*/)
    .filter((p) => p.trim().replace(/\s+/g, " "));
  return paragraphs.join("\n\n");
};

const validatePromptInfo = (promptInfo: PromptInfo): PromptInfo => {
  if (!promptInfo.style_linter_examples) {
    promptInfo.style_linter_examples = null;
    promptInfo.unstyled_response = null;
  }
  return promptInfo;
};

export const hasStaffMessages = async (conversationId: number, tx: Transaction | typeof db = db): Promise<boolean> => {
  const staffMessage = await tx.query.conversationMessages.findFirst({
    where: and(eq(conversationMessages.conversationId, conversationId), eq(conversationMessages.role, "staff")),
  });
  return !!staffMessage;
};

export const disableAIResponse = async (
  conversationId: number,
  mailbox: Pick<typeof mailboxes.$inferSelect, "disableAutoResponseForVips">,
  platformCustomer: PlatformCustomer | null,
) => {
  const requestHumanSupportEvent = await db.query.conversationEvents.findFirst({
    where: and(
      eq(conversationEvents.conversationId, conversationId),
      eq(conversationEvents.type, "request_human_support"),
    ),
  });

  return (
    !!requestHumanSupportEvent ||
    (platformCustomer?.isVip && mailbox.disableAutoResponseForVips) ||
    (await hasStaffMessages(conversationId))
  );
};
