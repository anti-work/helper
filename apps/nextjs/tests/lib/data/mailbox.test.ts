import { conversationFactory } from "@tests/support/factories/conversations";
import { escalationFactory } from "@tests/support/factories/escalations";
import { userFactory } from "@tests/support/factories/users";
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it, test, vi } from "vitest";
import { getBaseUrl } from "@/components/constants";
import { db } from "@/db/client";
import { escalations, mailboxes } from "@/db/schema";
import { env } from "@/env";
import { disconnectSlack, getMailboxInfo } from "@/lib/data/mailbox";
import { getClerkOrganization } from "@/lib/data/organization";
import { uninstallSlackApp } from "@/lib/slack/client";

vi.mock("@/lib/slack/client", () => ({
  uninstallSlackApp: vi.fn(),
}));

vi.mock("@/lib/data/organization", () => ({
  getClerkOrganization: vi.fn(),
}));

beforeEach(() => {
  vi.clearAllMocks();
});

test("getMailboxInfo", async () => {
  const { mailbox, organization } = await userFactory.createRootUser();
  vi.mocked(getClerkOrganization).mockResolvedValue(organization);
  const info = await getMailboxInfo(mailbox);
  expect(info).toEqual({
    id: mailbox.id,
    name: mailbox.name,
    slug: mailbox.slug,
    isStyleLinterEnabled: true,
    hasMetadataEndpoint: false,
    metadataEndpoint: null,
    slackConnected: false,
    slackConnectUrl: expect.any(String),
    slackEscalationChannel: null,
    escalationEmailBody: null,
    escalationEmailBodyPlaceholder: [
      "Hey there,",
      "Thank you for reporting this issue. Really sorry you ran into this!",
      "We are looking into it now and will get back to you soon about a solution.",
      "Let me know if you need any further help!",
      "",
      "Best,",
      `${mailbox.name} Support`,
    ].join("\n"),
    escalationExpectedResolutionHours: null,
    responseGeneratorPrompt: [],
    clerkOrganizationId: mailbox.clerkOrganizationId,
    subscription: null,
    widgetHMACSecret: mailbox.widgetHMACSecret,
    widgetDisplayMode: "off",
    widgetDisplayMinValue: null,
    widgetHost: null,
    autoRespondEmailToChat: false,
    vipThreshold: null,
    vipChannelId: null,
    vipExpectedResponseHours: null,
    disableAutoResponseForVips: false,
  });

  const slackConnectUrl = new URL(info.slackConnectUrl);
  expect(slackConnectUrl.origin).toBe("https://slack.com");
  expect(slackConnectUrl.pathname).toBe("/oauth/v2/authorize");
  const params = new URLSearchParams(slackConnectUrl.search);
  expect(params.get("scope")).toBe("channels:join,channels:read,chat:write,im:write,users:read,users:read.email");
  expect(params.get("redirect_uri")).toBe(`${getBaseUrl()}/api/connect/slack/callback`);
  expect(params.get("client_id")).toBe(env.SLACK_CLIENT_ID);
  expect(JSON.parse(params.get("state") || "{}")).toEqual({ mailbox_slug: mailbox.slug });
});

describe("disconnectSlack", () => {
  it("removes Slack-related data and resolves escalations", async () => {
    const { mailbox } = await userFactory.createRootUser({
      mailboxOverrides: {
        slackTeamId: "T12345",
        slackBotUserId: "U12345",
        slackBotToken: "xoxb-12345",
        slackEscalationChannel: "C12345",
      },
    });

    const { conversation: conversation1 } = await conversationFactory.create(mailbox.id);
    const { escalation: escalation1 } = await escalationFactory.create(conversation1.id);
    const { conversation: conversation2 } = await conversationFactory.create(mailbox.id);
    const { escalation: escalation2 } = await escalationFactory.create(conversation2.id);

    await disconnectSlack(mailbox.id);

    expect(uninstallSlackApp).toHaveBeenCalledWith("xoxb-12345");

    const updatedMailbox = await db.query.mailboxes.findFirst({
      where: eq(mailboxes.id, mailbox.id),
    });

    expect(updatedMailbox).toMatchObject({
      slackTeamId: null,
      slackBotUserId: null,
      slackBotToken: null,
      slackEscalationChannel: null,
    });

    const updatedEscalation1 = await db.query.escalations.findFirst({
      where: eq(escalations.id, escalation1.id),
    });
    expect(updatedEscalation1?.resolvedAt).not.toBeNull();

    const updatedEscalation2 = await db.query.escalations.findFirst({
      where: eq(escalations.id, escalation2.id),
    });
    expect(updatedEscalation2?.resolvedAt).not.toBeNull();
  });

  it("silently continues if the Slack API call fails", async () => {
    const { mailbox } = await userFactory.createRootUser({
      mailboxOverrides: {
        slackTeamId: "T12345",
        slackBotUserId: "U12345",
        slackBotToken: "xoxb-12345",
        slackEscalationChannel: "C12345",
      },
    });

    vi.mocked(uninstallSlackApp).mockRejectedValue(
      new Error("Failed to uninstall Slack app: App not installed in workspace"),
    );

    await disconnectSlack(mailbox.id);

    expect(uninstallSlackApp).toHaveBeenCalledWith("xoxb-12345");

    const updatedMailbox = await db.query.mailboxes.findFirst({
      where: eq(mailboxes.id, mailbox.id),
    });

    expect(updatedMailbox).toMatchObject({
      slackTeamId: null,
      slackBotUserId: null,
      slackBotToken: null,
      slackEscalationChannel: null,
    });
  });

  it("handles case when Slack is already disconnected", async () => {
    const { mailbox } = await userFactory.createRootUser({
      mailboxOverrides: {
        slackTeamId: null,
        slackBotUserId: null,
        slackBotToken: null,
        slackEscalationChannel: null,
      },
    });

    await disconnectSlack(mailbox.id);

    expect(uninstallSlackApp).not.toHaveBeenCalled();
  });
});
