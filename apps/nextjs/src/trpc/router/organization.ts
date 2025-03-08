import { currentUser } from "@clerk/nextjs/server";
import { TRPCError, type TRPCRouterRecord } from "@trpc/server";
import { SUBSCRIPTION_FREE_TRIAL_USAGE_LIMIT } from "@/components/constants";
import { assertDefined } from "@/components/utils/assert";
import { createOrganization, getClerkOrganization, getSubscriptionStatus } from "@/lib/data/organization";
import { getClerkUserList } from "@/lib/data/user";
import { protectedProcedure, publicProcedure } from "../trpc";

export const organizationRouter = {
  createDefaultOrganization: publicProcedure.mutation(async ({ ctx }) => {
    if (!ctx.session?.userId) throw new TRPCError({ code: "UNAUTHORIZED" });
    if (ctx.session?.orgId) throw new TRPCError({ code: "BAD_REQUEST", message: "Organization already exists" });

    const user = assertDefined(await currentUser());
    const organization = await createOrganization(user);
    return { id: organization.id };
  }),
  getOnboardingStatus: protectedProcedure.query(async ({ ctx }) => {
    const organization = await getClerkOrganization(ctx.session.orgId);
    return {
      trialInfo: {
        freeTrialEndsAt: organization.privateMetadata.freeTrialEndsAt
          ? new Date(organization.privateMetadata.freeTrialEndsAt)
          : null,
        resolutionsCount: organization.privateMetadata.automatedRepliesCount ?? null,
        resolutionsLimit: SUBSCRIPTION_FREE_TRIAL_USAGE_LIMIT,
        subscriptionStatus: await getSubscriptionStatus(organization),
      },
    };
  }),
  getMembers: protectedProcedure.query(async ({ ctx }) => {
    const organization = await getClerkOrganization(ctx.session.orgId);
    const users = await getClerkUserList(organization.id);
    return users.data.map((user) => ({ id: user.id, displayName: user.fullName ?? user.id }));
  }),
} satisfies TRPCRouterRecord;
