import "server-only";
import { and, eq, isNull } from "drizzle-orm";
import { cache } from "react";
import { assertDefined } from "@/components/utils/assert";
import { db, Transaction } from "@/db/client";
import { mailboxes, mailboxesMetadataApi, subscriptions } from "@/db/schema";
import { env } from "@/env";
import { getGitHubConnectUrl } from "@/lib/github/client";
import { uninstallSlackApp } from "@/lib/slack/client";
import { REQUIRED_SCOPES, SLACK_REDIRECT_URI } from "@/lib/slack/constants";
import { captureExceptionAndLogIfDevelopment } from "../shared/sentry";
import { getClerkOrganization } from "./organization";

export const getMailboxById = cache(async (id: number): Promise<Mailbox | null> => {
  const result = await db.query.mailboxes.findFirst({
    where: eq(mailboxes.id, id),
  });
  return result ?? null;
});

export const getMailboxBySlug = cache(async (slug: string): Promise<typeof mailboxes.$inferSelect | null> => {
  const result = await db.query.mailboxes.findFirst({
    where: eq(mailboxes.slug, slug),
  });
  return result ?? null;
});

export const resetMailboxPromptUpdatedAt = async (tx: Transaction, mailboxId: number) => {
  await tx.update(mailboxes).set({ promptUpdatedAt: new Date() }).where(eq(mailboxes.id, mailboxId));
};

export type Mailbox = typeof mailboxes.$inferSelect;

const getSlackConnectUrl = (mailboxSlug: string): string => {
  const params = new URLSearchParams({
    scope: REQUIRED_SCOPES.join(","),
    redirect_uri: SLACK_REDIRECT_URI,
    client_id: env.SLACK_CLIENT_ID,
    state: JSON.stringify({ mailbox_slug: mailboxSlug }),
  });

  return `https://slack.com/oauth/v2/authorize?${params.toString()}`;
};

export const getMailboxInfo = async (mailbox: typeof mailboxes.$inferSelect) => {
  const organization = await getClerkOrganization(mailbox.clerkOrganizationId);
  const subscription = await db.query.subscriptions.findFirst({
    where: and(eq(subscriptions.clerkOrganizationId, organization.id)),
    columns: {
      canceledAt: true,
      status: true,
      stripeSubscriptionId: true,
    },
  });
  const metadataEndpoint = await db.query.mailboxesMetadataApi.findFirst({
    where: and(
      eq(mailboxesMetadataApi.mailboxId, mailbox.id),
      isNull(mailboxesMetadataApi.deletedAt),
      eq(mailboxesMetadataApi.isEnabled, true),
    ),
    columns: {
      isEnabled: true,
      deletedAt: true,
      url: true,
      hmacSecret: true,
    },
  });

  return {
    id: mailbox.id,
    name: mailbox.name,
    slug: mailbox.slug,
    isStyleLinterEnabled: !!organization.privateMetadata.isStyleLinterEnabled,
    hasMetadataEndpoint: !!metadataEndpoint,
    metadataEndpoint: metadataEndpoint ?? null,
    slackConnected: !!mailbox.slackBotToken,
    slackConnectUrl: getSlackConnectUrl(mailbox.slug),
    slackAlertChannel: mailbox.slackAlertChannel,
    githubConnected: !!mailbox.githubAccessToken,
    githubConnectUrl: getGitHubConnectUrl(mailbox.slug),
    githubUsername: mailbox.githubUsername,
    githubRepoOwner: mailbox.githubRepoOwner,
    githubRepoName: mailbox.githubRepoName,
    responseGeneratorPrompt: mailbox.responseGeneratorPrompt ?? [],
    clerkOrganizationId: mailbox.clerkOrganizationId,
    subscription: subscription ?? null,
    widgetHMACSecret: mailbox.widgetHMACSecret,
    widgetDisplayMode: mailbox.widgetDisplayMode,
    widgetDisplayMinValue: mailbox.widgetDisplayMinValue,
    widgetHost: mailbox.widgetHost,
    autoRespondEmailToChat: mailbox.autoRespondEmailToChat,
    vipThreshold: mailbox.vipThreshold,
    vipChannelId: mailbox.vipChannelId,
    vipExpectedResponseHours: mailbox.vipExpectedResponseHours,
    disableAutoResponseForVips: mailbox.disableAutoResponseForVips,
  };
};

export const disconnectSlack = async (mailboxId: number): Promise<void> => {
  const mailbox = assertDefined(
    await db.query.mailboxes.findFirst({
      where: eq(mailboxes.id, mailboxId),
      columns: {
        slackBotToken: true,
      },
    }),
  );

  if (!mailbox?.slackBotToken) return;

  try {
    await uninstallSlackApp(mailbox.slackBotToken);
  } catch (error) {
    // Likely indicates that the app was already uninstalled from the Slack UI
    captureExceptionAndLogIfDevelopment(error, { level: "info" });
  }

  await db
    .update(mailboxes)
    .set({
      slackTeamId: null,
      slackBotUserId: null,
      slackBotToken: null,
      slackAlertChannel: null,
    })
    .where(eq(mailboxes.id, mailboxId));
};

export const disconnectGitHub = async (mailboxId: number): Promise<void> => {
  try {
    await db
      .update(mailboxes)
      .set({
        githubAccessToken: null,
        githubUsername: null,
        githubRepoOwner: null,
        githubRepoName: null,
      })
      .where(eq(mailboxes.id, mailboxId));
  } catch (error) {
    captureExceptionAndLogIfDevelopment(error);
    throw error;
  }
};

export const updateGitHubRepo = async (mailboxId: number, repoOwner: string, repoName: string): Promise<void> => {
  try {
    await db
      .update(mailboxes)
      .set({
        githubRepoOwner: repoOwner,
        githubRepoName: repoName,
      })
      .where(eq(mailboxes.id, mailboxId));
  } catch (error) {
    captureExceptionAndLogIfDevelopment(error);
    throw error;
  }
};

export const getResponseGeneratorPromptText = (responseGeneratorPrompt: string[]): string => {
  return responseGeneratorPrompt.join("\n");
};
