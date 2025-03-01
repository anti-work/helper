import { userFactory } from "@tests/support/factories/users";
import { mockInngest } from "@tests/support/inngestUtils";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { generateMailboxReport, generateWeeklyReports } from "@/inngest/functions/generateWeeklyReports";
import { getMemberStats } from "@/lib/data/stats";
import { listSlackUsers, postSlackMessage } from "@/lib/slack/client";

// Mock dependencies
vi.mock("@/lib/data/stats", () => ({
  getMemberStats: vi.fn(),
}));

vi.mock("@/lib/slack/client", () => ({
  postSlackMessage: vi.fn(),
  listSlackUsers: vi.fn(),
}));

const inngestMock = mockInngest();

describe("generateWeeklyReports", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("sends weekly report events for mailboxes with Slack configured", async () => {
    const { mailbox: mailboxWithSlack } = await userFactory.createRootUser({
      mailboxOverrides: {
        slackBotToken: "valid-token",
        slackEscalationChannel: "channel-id",
      },
    });

    const { mailbox: mailboxWithoutSlack } = await userFactory.createRootUser({
      mailboxOverrides: {
        slackBotToken: null,
        slackEscalationChannel: null,
      },
    });

    await generateWeeklyReports();

    expect(inngestMock.send).toHaveBeenCalledTimes(1);
    expect(inngestMock.send).toHaveBeenCalledWith({
      name: "reports/weekly",
      data: {
        mailboxId: mailboxWithSlack.id,
      },
    });
  });
});

describe("generateMailboxWeeklyReport", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("generates and posts report to Slack when there are stats", async () => {
    const { mailbox } = await userFactory.createRootUser({
      mailboxOverrides: {
        slackBotToken: "valid-token",
        slackEscalationChannel: "channel-id",
      },
    });

    vi.mocked(getMemberStats).mockResolvedValue([
      { id: "user1", email: "john@example.com", displayName: "John Doe", replyCount: 5 },
    ]);

    vi.mocked(listSlackUsers).mockResolvedValue([{ id: "SLACK123", profile: { email: "john@example.com" } }]);

    const result = await generateMailboxReport({
      mailbox,
      slackBotToken: mailbox.slackBotToken!,
      slackEscalationChannel: mailbox.slackEscalationChannel!,
    });

    expect(postSlackMessage).toHaveBeenCalledWith(
      "valid-token",
      expect.objectContaining({
        channel: "channel-id",
        blocks: [
          {
            type: "section",
            text: {
              type: "plain_text",
              text: `Last week in the ${mailbox.name} mailbox:`,
              emoji: true,
            },
          },
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text: "• <@SLACK123>: 5",
            },
          },
          {
            type: "divider",
          },
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text: "*Total replies:*\n5 from 1 person",
            },
          },
        ],
        text: expect.stringMatching(/Week of \d{4}-\d{2}-\d{2} to \d{4}-\d{2}-\d{2}/),
      }),
    );

    expect(result).toBe("Report sent");
  });

  it("skips report generation when there are no stats", async () => {
    const { mailbox } = await userFactory.createRootUser({
      mailboxOverrides: {
        slackBotToken: "valid-token",
        slackEscalationChannel: "channel-id",
      },
    });

    vi.mocked(getMemberStats).mockResolvedValue([]);

    const result = await generateMailboxReport({
      mailbox,
      slackBotToken: mailbox.slackBotToken!,
      slackEscalationChannel: mailbox.slackEscalationChannel!,
    });

    expect(postSlackMessage).not.toHaveBeenCalled();
    expect(result).toBe("No stats found");
  });
});
