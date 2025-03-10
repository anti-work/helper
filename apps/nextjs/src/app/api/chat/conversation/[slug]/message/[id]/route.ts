import { waitUntil } from "@vercel/functions";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { authenticateWidget } from "@/app/api/widget/utils";
import { takeUniqueOrThrow } from "@/components/utils/arrays";
import { assertDefined } from "@/components/utils/assert";
import { db } from "@/db/client";
import { conversationMessages, conversations } from "@/db/schema";
import { dashboardChannelId } from "@/lib/ably/channels";
import { publishToAbly } from "@/lib/ably/client";
import { createReactionEventPayload } from "@/lib/data/dashboardEvent";
import { langfuse } from "@/lib/langfuse/client";

const MessageReactionSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("thumbs-up"),
  }),
  z.object({
    type: z.literal("thumbs-down"),
    feedback: z.string().nullish(),
  }),
]);

export async function POST(request: Request, { params }: { params: Promise<{ id: string; slug: string }> }) {
  const { id, slug } = await params;

  const authResult = await authenticateWidget(request);
  if (!authResult.success) {
    return Response.json({ error: authResult.error }, { status: 401 });
  }

  let messageId;
  try {
    const parsedId = z.coerce.bigint().parse(id);
    messageId = Number(parsedId);
  } catch {
    return Response.json({ error: "Invalid message ID" }, { status: 400 });
  }

  const message = await db
    .select({
      reactionType: conversationMessages.reactionType,
      reactionFeedback: conversationMessages.reactionFeedback,
      metadata: conversationMessages.metadata,
      conversation: {
        emailFrom: conversations.emailFrom,
      },
    })
    .from(conversationMessages)
    .innerJoin(conversations, eq(conversationMessages.conversationId, conversations.id))
    .where(and(eq(conversationMessages.id, messageId), eq(conversations.slug, slug)))
    .limit(1)
    .then(takeUniqueOrThrow);

  if (!message || (message.conversation.emailFrom && message.conversation.emailFrom !== authResult.session.email)) {
    return Response.json({ error: "Message not found" }, { status: 404 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const reactionResult = MessageReactionSchema.safeParse({
    ...body,
    messageId,
  });

  if (!reactionResult.success) {
    return Response.json({ error: "Invalid reaction" }, { status: 400 });
  }

  const reaction = reactionResult.data;

  const traceId = message.metadata && "trace_id" in message.metadata ? (message.metadata.trace_id as string) : null;
  if (traceId) {
    try {
      langfuse.score({
        traceId,
        name: "user_feedback",
        value: reaction.type === "thumbs-up" ? 1 : 0,
        comment: reaction.type === "thumbs-down" ? reaction.feedback || undefined : undefined,
      });
    } catch (error) {
      console.error("Failed to send feedback to Langfuse:", error);
    }
  }

  if (message.reactionType === "thumbs-down" && reaction.type === "thumbs-down" && message.reactionFeedback == null) {
    await db
      .update(conversationMessages)
      .set({
        reactionFeedback: reaction.feedback,
        reactionCreatedAt: new Date(),
      })
      .where(eq(conversationMessages.id, messageId));
    waitUntil(publishEvent(slug, messageId));
    return Response.json({ reaction });
  }

  if (message.reactionType === reaction.type) {
    await db
      .update(conversationMessages)
      .set({
        reactionType: null,
        reactionFeedback: null,
        reactionCreatedAt: null,
      })
      .where(eq(conversationMessages.id, messageId));
    waitUntil(publishEvent(slug, messageId));
    return Response.json({ reaction: null });
  }

  await db
    .update(conversationMessages)
    .set({
      reactionType: reaction.type,
      reactionFeedback: reaction.type === "thumbs-down" ? reaction.feedback : null,
      reactionCreatedAt: new Date(),
    })
    .where(eq(conversationMessages.id, messageId));
  waitUntil(publishEvent(slug, messageId));
  waitUntil(langfuse.flushAsync());

  return Response.json({ reaction });
}

const publishEvent = async (mailboxSlug: string, messageId: number) => {
  const message = assertDefined(
    await db.query.conversationMessages.findFirst({
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
            mailbox: true,
          },
        },
      },
      where: eq(conversationMessages.id, messageId),
    }),
  );

  await publishToAbly({
    channel: dashboardChannelId(mailboxSlug),
    event: "event",
    data: createReactionEventPayload(message, message.conversation.mailbox),
  });
};
