import { desc, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { conversationEvents, mailboxes } from "@/db/schema";
import { inngest } from "@/inngest/client";
import { assertDefinedOrRaiseNonRetriableError } from "@/inngest/utils";
import { dashboardChannelId } from "@/lib/ably/channels";
import { publishToAbly } from "@/lib/ably/client";
import { createHumanSupportRequestEventPayload } from "@/lib/data/dashboardEvent";

export default inngest.createFunction(
  { id: "publish-request-human-support" },
  { event: "conversations/human-support-requested" },
  async ({ event: { data }, step }) => {
    const { mailboxSlug, conversationId } = data;

    await step.run("publish", async () => {
      const mailbox = assertDefinedOrRaiseNonRetriableError(
        await db.query.mailboxes.findFirst({
          where: eq(mailboxes.slug, mailboxSlug),
        }),
      );

      const event = assertDefinedOrRaiseNonRetriableError(
        await db.query.conversationEvents.findFirst({
          where: eq(conversationEvents.conversationId, conversationId),
          with: {
            conversation: {
              columns: { id: true, slug: true, emailFrom: true, subject: true },
              with: {
                platformCustomer: { columns: { value: true } },
              },
            },
          },
          orderBy: desc(conversationEvents.createdAt),
        }),
      );

      await publishToAbly({
        channel: dashboardChannelId(mailboxSlug),
        event: "event",
        data: createHumanSupportRequestEventPayload(event, mailbox),
      });
    });

    return { success: true };
  },
);
