import { currentUser } from "@clerk/nextjs/server";
import type { TRPCRouterRecord } from "@trpc/server";
import { subHours } from "date-fns";
import { and, count, eq, inArray, isNotNull, isNull, SQL } from "drizzle-orm";
import { z } from "zod";
import { setupOrganizationForNewUser } from "@/auth/lib/authService";
import { assertDefined } from "@/components/utils/assert";
import { db } from "@/db/client";
import { conversations, mailboxes } from "@/db/schema";
import { getMailboxInfo } from "@/lib/data/mailbox";
import { getClerkOrganization } from "@/lib/data/organization";
import { getMemberStats } from "@/lib/data/stats";
import { protectedProcedure } from "@/trpc/trpc";
import { conversationsRouter } from "./conversations/index";
import { customersRouter } from "./customers";
import { faqsRouter } from "./faqs";
import { githubRouter } from "./github";
import { githubConversationsRouter } from "./githubConversationsRouter";
import { metadataEndpointRouter } from "./metadataEndpoint";
import { mailboxProcedure } from "./procedure";
import { slackRouter } from "./slack";
import { styleLintersRouter } from "./styleLinters";
import { toolsRouter } from "./tools";
import { websitesRouter } from "./websites";
import { workflowsRouter } from "./workflows";

export { mailboxProcedure };

export const mailboxRouter = {
  list: protectedProcedure.query(async ({ ctx }) => {
    const organization = await getClerkOrganization(ctx.session.orgId);
    const allMailboxes = await db.query.mailboxes.findMany({
      where: eq(mailboxes.clerkOrganizationId, organization.id),
      columns: {
        id: true,
        name: true,
        slug: true,
      },
    });

    if (allMailboxes.length === 0) {
      const mailbox = await setupOrganizationForNewUser(
        await getClerkOrganization(ctx.session.orgId),
        assertDefined(await currentUser()),
      );
      allMailboxes.push(mailbox);
    }

    const openTicketCountByMailbox = await db
      .select({
        mailboxId: conversations.mailboxId,
        count: count(conversations.id),
      })
      .from(conversations)
      .where(
        and(
          eq(conversations.status, "open"),
          inArray(
            conversations.mailboxId,
            allMailboxes.map(({ id }) => id),
          ),
        ),
      )
      .groupBy(conversations.mailboxId);

    return allMailboxes.map((mailbox) => ({
      ...mailbox,
      openTicketCount: openTicketCountByMailbox.find(({ mailboxId }) => mailboxId === mailbox.id)?.count ?? 0,
    }));
  }),
  countByStatus: mailboxProcedure.query(async ({ ctx }) => {
    const countByStatus = async (where?: SQL) => {
      const result = await db
        .select({ status: conversations.status, count: count() })
        .from(conversations)
        .where(and(eq(conversations.mailboxId, ctx.mailbox.id), where))
        .groupBy(conversations.status);
      return {
        open: result.find((c) => c.status === "open")?.count ?? 0,
        closed: result.find((c) => c.status === "closed")?.count ?? 0,
        spam: result.find((c) => c.status === "spam")?.count ?? 0,
      };
    };

    const [all, mine, assigned, unassigned] = await Promise.all([
      countByStatus(),
      countByStatus(eq(conversations.assignedToClerkId, ctx.session.userId)),
      countByStatus(isNotNull(conversations.assignedToClerkId)),
      countByStatus(isNull(conversations.assignedToClerkId)),
    ]);

    return {
      conversations: all,
      mine,
      assigned,
      unassigned,
    };
  }),

  get: mailboxProcedure.query(async ({ ctx }) => {
    return await getMailboxInfo(ctx.mailbox);
  }),
  update: mailboxProcedure
    .input(
      z.object({
        slackAlertChannel: z.string().optional(),
        githubRepoOwner: z.string().optional(),
        githubRepoName: z.string().optional(),
        responseGeneratorPrompt: z.array(z.string()).optional(),
        widgetDisplayMode: z.enum(["off", "always", "revenue_based"]).optional(),
        widgetDisplayMinValue: z.number().optional(),
        autoRespondEmailToChat: z.boolean().optional(),
        widgetHost: z.string().optional(),
        vipThreshold: z.number().optional(),
        vipChannelId: z.string().optional(),
        vipExpectedResponseHours: z.number().optional(),
        disableAutoResponseForVips: z.boolean().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const mailboxId = ctx.mailbox.id;
      const updates = input.responseGeneratorPrompt ? { ...input, promptUpdatedAt: new Date() } : input;
      await db.update(mailboxes).set(updates).where(eq(mailboxes.id, mailboxId));
    }),
  members: mailboxProcedure
    .input(
      z.object({
        period: z.enum(["24h", "7d", "30d", "1y"]),
        customDate: z.date().optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const now = new Date();
      const periodInHours = {
        "24h": 24,
        "7d": 24 * 7,
        "30d": 24 * 30,
        "1y": 24 * 365,
      } as const;

      const startDate = input.customDate || subHours(now, periodInHours[input.period]);
      return await getMemberStats(ctx.mailbox, { startDate, endDate: now });
    }),
  styleLinters: styleLintersRouter,
  conversations: {
    ...githubConversationsRouter,
    ...conversationsRouter,
  },
  faqs: faqsRouter,
  workflows: workflowsRouter,
  slack: slackRouter,
  github: githubRouter,
  tools: toolsRouter,
  customers: customersRouter,
  websites: websitesRouter,
  metadataEndpoint: metadataEndpointRouter,
} satisfies TRPCRouterRecord;
