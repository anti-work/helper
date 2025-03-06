import { conversationMessagesFactory } from "@tests/support/factories/conversationMessages";
import { conversationFactory } from "@tests/support/factories/conversations";
import { fileFactory } from "@tests/support/factories/files";
import { gmailSupportEmailFactory } from "@tests/support/factories/gmailSupportEmails";
import { subscriptionFactory } from "@tests/support/factories/subscriptions";
import { userFactory } from "@tests/support/factories/users";
import { addDays } from "date-fns";
import { eq } from "drizzle-orm/expressions";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SUBSCRIPTION_FREE_TRIAL_USAGE_LIMIT } from "@/components/constants";
import { takeUniqueOrThrow } from "@/components/utils/arrays";
import { assertDefined } from "@/components/utils/assert";
import { db } from "@/db/client";
import { conversationMessages, conversations, mailboxes } from "@/db/schema";
import AutomatedRepliesLimitExceededEmail from "@/emails/automatedRepliesLimitExceeded";
import { postEmailToGmail, trackWorkflowReply } from "@/inngest/functions/postEmailToGmail";
import { getClerkOrganization, getOrganizationAdminUsers, setPrivateMetadata } from "@/lib/data/organization";
import { billWorkflowReply, isBillable } from "@/lib/data/subscription";
import { getClerkUser } from "@/lib/data/user";
import { getMessageMetadataById, sendGmailEmail } from "@/lib/gmail/client";
import { convertEmailToRaw } from "@/lib/gmail/lib";
import { sendEmail } from "@/lib/resend/client";
import * as sentryUtils from "@/lib/shared/sentry";

vi.mock("@/lib/resend/client", () => ({
  sendEmail: vi.fn(),
}));
vi.mock("@/emails/automatedRepliesLimitExceeded", () => ({
  default: vi.fn().mockReturnValue("Mock component"),
}));
vi.mock("@/lib/data/subscription", () => ({
  billWorkflowReply: vi.fn(),
  isBillable: vi.fn(),
}));
vi.mock("@/lib/stripe/client");
vi.mock("@/lib/data/user", () => ({
  getClerkUser: vi.fn(),
  getRootUserByOrganizationId: vi.fn(),
}));
vi.mock("@/lib/data/organization", async () => {
  const actual = await vi.importActual("@/lib/data/organization");
  return {
    ...actual,
    getClerkOrganization: vi.fn(),
    setPrivateMetadata: vi.fn(),
    getOrganizationAdminUsers: vi.fn(),
  };
});
vi.spyOn(sentryUtils, "captureExceptionAndThrowIfDevelopment");

beforeEach(() => {
  vi.clearAllMocks();
});

vi.mock("@/lib/gmail/client", () => ({
  sendGmailEmail: vi.fn().mockImplementation(() => ({
    status: 200,
    data: { id: "sent-gmail-message-id", threadId: "sent-gmail-thread-id" },
  })),
  getMessageMetadataById: vi.fn(),
  getGmailService: vi.fn().mockImplementation(() => "mock client"),
}));

vi.mock("@/lib/gmail/lib", () => ({
  convertEmailToRaw: vi.fn().mockImplementation(() => "mock raw email"),
}));

const setupConversationForGmailSending = async () => {
  const { mailbox, organization } = await userFactory.createRootUser();

  const { conversation } = await conversationFactory.create(mailbox.id, {
    conversationProvider: "gmail",
    status: "closed",
    subject: "Conversation subject",
    emailFrom: "to@example.com",
  });

  const { gmailSupportEmail } = await gmailSupportEmailFactory.create({
    email: "test@example.com",
    accessToken: "testAccessToken",
    refreshToken: "testRefreshToken",
  });
  const updatedMailbox = await db
    .update(mailboxes)
    .set({ gmailSupportEmailId: gmailSupportEmail.id })
    .where(eq(mailboxes.id, mailbox.id))
    .returning()
    .then(takeUniqueOrThrow);

  return {
    conversation,
    mailbox: { ...updatedMailbox, gmailSupportEmail },
    organization,
  };
};

const assertMarkSent = async (emailId: number) => {
  const email = await db.query.conversationMessages.findFirst({ where: eq(conversationMessages.id, emailId) });
  expect(email?.status).toBe("sent");
};

const assertMarkFailed = async (emailId: number) => {
  const email = await db.query.conversationMessages
    .findFirst({ where: eq(conversationMessages.id, emailId) })
    .then(assertDefined);
  expect(email.status).toBe("failed");
  expect(await db.query.conversations.findFirst({ where: eq(conversations.id, email.conversationId) })).toMatchObject({
    status: "open",
  });
};

describe("postEmailToGmail", () => {
  describe("on success", () => {
    it("properly posts to Gmail", async () => {
      const { conversation, mailbox, organization } = await setupConversationForGmailSending();

      const { message } = await conversationMessagesFactory.createEnqueued(conversation.id, {
        body: "Content",
      });

      const { file: file1 } = await fileFactory.create(null, {
        isInline: true,
        name: "file1.pdf",
        url: "https://your-bucket-name.s3.amazonaws.com/attachments/file1.pdf",
        mimetype: "text/plain",
        messageId: message.id,
      });
      const { file: file2 } = await fileFactory.create(null, {
        isInline: false,
        name: "file2.jpg",
        url: "https://your-bucket-name.s3.amazonaws.com/attachments/file2.jpg",
        mimetype: "image/jpeg",
        messageId: message.id,
      });

      vi.mocked(getMessageMetadataById).mockResolvedValueOnce({
        data: {
          payload: {
            headers: [
              { name: "Message-ID", value: "<new-message-id@example.com>" },
              { name: "References", value: "<reference1@example.com> <reference2@example.com>" },
            ],
          },
        },
      } as any);

      vi.mocked(getClerkOrganization).mockResolvedValue(organization);
      vi.mocked(setPrivateMetadata).mockResolvedValue(organization);

      expect(await postEmailToGmail(message.id)).toBeNull();
      expect(convertEmailToRaw).toHaveBeenCalledTimes(1);
      expect(convertEmailToRaw).toHaveBeenCalledWith(
        expect.objectContaining({
          ...message,
          conversation: expect.objectContaining({
            ...conversation,
            emailFrom: "to@example.com",
            mailbox: {
              clerkOrganizationId: mailbox.clerkOrganizationId,
              slug: mailbox.slug,
              gmailSupportEmail: mailbox.gmailSupportEmail,
            },
          }),
          files: expect.arrayContaining([
            expect.objectContaining({ id: file1.id }),
            expect.objectContaining({ id: file2.id }),
          ]),
        }),
        "test@example.com",
      );
      expect(sendGmailEmail).toHaveBeenCalledTimes(1);
      expect(sendGmailEmail).toHaveBeenCalledWith("mock client", "mock raw email", null);
      await assertMarkSent(message.id);

      const updatedMessage = await db.query.conversationMessages.findFirst({
        where: eq(conversationMessages.id, message.id),
      });
      expect(updatedMessage).toMatchObject({
        gmailMessageId: "sent-gmail-message-id",
        gmailThreadId: "sent-gmail-thread-id",
        messageId: "<new-message-id@example.com>",
        references: "<reference1@example.com> <reference2@example.com>",
      });
    });

    it("includes the correct threadId for reply emails", async () => {
      const { conversation, mailbox, organization } = await setupConversationForGmailSending();
      await conversationMessagesFactory.create(conversation.id, {
        body: "User email that initiated the conversation",
        role: "user",
        gmailThreadId: "testThreadId",
        gmailMessageId: "testMessageId",
        messageId: "<messageId>",
        references: null,
      });

      const { message } = await conversationMessagesFactory.createEnqueued(conversation.id, {
        body: "Content",
      });

      vi.mocked(getClerkOrganization).mockResolvedValue(organization);
      vi.mocked(setPrivateMetadata).mockResolvedValue(organization);

      expect(await postEmailToGmail(message.id)).toBeNull();
      expect(convertEmailToRaw).toHaveBeenCalledTimes(1);
      expect(convertEmailToRaw).toHaveBeenCalledWith(
        expect.objectContaining({
          ...message,
          conversation: expect.objectContaining({
            ...conversation,
            emailFrom: "to@example.com",
            mailbox: {
              clerkOrganizationId: mailbox.clerkOrganizationId,
              slug: mailbox.slug,
              gmailSupportEmail: mailbox.gmailSupportEmail,
            },
          }),
          files: [],
        }),
        "test@example.com",
      );
      expect(sendGmailEmail).toHaveBeenCalledTimes(1);
      expect(sendGmailEmail).toHaveBeenCalledWith("mock client", "mock raw email", "testThreadId");
      await assertMarkSent(message.id);
    });

    it("increments `automatedRepliesCount` for sent workflow emails", async () => {
      const { conversation, mailbox, organization } = await setupConversationForGmailSending();

      const { message } = await conversationMessagesFactory.createEnqueued(conversation.id, {
        role: "workflow",
      });

      vi.mocked(getMessageMetadataById).mockResolvedValueOnce({
        data: {
          payload: {
            headers: [{ name: "Message-ID", value: "<new-message-id@example.com>" }],
          },
        },
      } as any);
      vi.mocked(getClerkOrganization).mockResolvedValue(organization);
      vi.mocked(setPrivateMetadata).mockResolvedValue(organization);

      expect(await postEmailToGmail(message.id)).toBeNull();
      expect(setPrivateMetadata).toHaveBeenCalledWith(organization.id, {
        automatedRepliesCount: assertDefined(organization.privateMetadata.automatedRepliesCount) + 1,
      });
    });
  });

  describe("on failure", () => {
    it("returns null when the email is soft-deleted or not a queueing staff email", async () => {
      const { conversation } = await setupConversationForGmailSending();

      const { message } = await conversationMessagesFactory.createEnqueued(conversation.id, {
        body: "Content",
        deletedAt: new Date(),
      });

      expect(await postEmailToGmail(message.id)).toBeNull();
      expect(await db.query.conversations.findFirst({ where: eq(conversations.id, conversation.id) })).toMatchObject({
        status: "closed",
      });
      expect(
        await db.query.conversationMessages.findFirst({ where: eq(conversationMessages.id, message.id) }),
      ).toMatchObject({
        status: "queueing",
      });
    });

    it("marks the email as failed when the conversation emailFrom is missing", async () => {
      const { conversation } = await setupConversationForGmailSending();
      const updatedConversation = await db
        .update(conversations)
        .set({ emailFrom: null })
        .where(eq(conversations.id, conversation.id))
        .returning()
        .then(takeUniqueOrThrow);

      const { message } = await conversationMessagesFactory.createEnqueued(updatedConversation.id, {
        body: "Content",
      });
      expect(await postEmailToGmail(message.id)).toEqual("The conversation emailFrom is missing.");
      await assertMarkFailed(message.id);
    });

    it("marks the email as failed when the mailbox does not have a connected Gmail account", async () => {
      const { conversation, mailbox } = await setupConversationForGmailSending();
      await db.update(mailboxes).set({ gmailSupportEmailId: null }).where(eq(mailboxes.id, mailbox.id));

      const { message } = await conversationMessagesFactory.createEnqueued(conversation.id, {
        body: "Content",
      });
      expect(await postEmailToGmail(message.id)).toEqual("The mailbox does not have a connected Gmail account.");
      await assertMarkFailed(message.id);
    });

    it("marks the email as failed when there is an unexpected error", async () => {
      const { conversation } = await setupConversationForGmailSending();

      const { message } = await conversationMessagesFactory.createEnqueued(conversation.id, {
        body: "Content",
      });

      vi.mocked(sendGmailEmail).mockRejectedValueOnce(new Error("RIP"));
      vi.mocked(sentryUtils.captureExceptionAndThrowIfDevelopment).mockImplementation(() => {});

      expect(await postEmailToGmail(message.id)).toEqual("Unexpected error: Error: RIP");
      await assertMarkFailed(message.id);
    });
  });
});

describe("trackAndBillWorkflowReply", () => {
  it("bills for the workflow reply if a subscription exists", async () => {
    const { organization, mailbox } = await userFactory.createRootUser({});
    const { conversation } = await conversationFactory.create(mailbox.id);
    const { message } = await conversationMessagesFactory.createEnqueued(conversation.id, {
      role: "workflow",
    });

    await trackWorkflowReply(message.id, mailbox.slug, organization.id);
    expect(billWorkflowReply).toHaveBeenCalledTimes(0);
    expect(isBillable).toHaveBeenCalledTimes(0);

    const { subscription } = await subscriptionFactory.create(organization.id);
    vi.mocked(isBillable).mockResolvedValue(false);
    await trackWorkflowReply(message.id, mailbox.slug, organization.id);
    expect(billWorkflowReply).toHaveBeenCalledTimes(0);
    expect(isBillable).toHaveBeenCalledWith(subscription);
    expect(isBillable).toHaveBeenCalledTimes(1);

    vi.mocked(isBillable).mockResolvedValue(true);
    await trackWorkflowReply(message.id, mailbox.slug, organization.id);

    expect(billWorkflowReply).toHaveBeenCalledTimes(1);
    expect(isBillable).toHaveBeenCalledTimes(2);
    expect(isBillable).toHaveBeenCalledWith(subscription);
  });

  it("emails organizations that reach their auto reply limit", async () => {
    const { organization, mailbox, user } = await userFactory.createRootUser({
      organizationOverrides: {
        privateMetadata: {
          freeTrialEndsAt: addDays(new Date(), 30).toISOString(),
          automatedRepliesCount: SUBSCRIPTION_FREE_TRIAL_USAGE_LIMIT - 1,
        },
      },
    });
    const { conversation } = await conversationFactory.create(mailbox.id);
    const { message } = await conversationMessagesFactory.createEnqueued(conversation.id, {
      role: "workflow",
    });

    vi.mocked(getClerkUser).mockResolvedValue({
      id: user.id,
      emailAddresses: [{ emailAddress: user.emailAddresses[0]?.emailAddress }],
    } as any);
    vi.mocked(getClerkOrganization).mockResolvedValue(organization);
    vi.mocked(getOrganizationAdminUsers).mockResolvedValue([user]);
    vi.mocked(setPrivateMetadata).mockResolvedValue({
      ...organization,
      privateMetadata: {
        ...organization.privateMetadata,
        automatedRepliesCount: SUBSCRIPTION_FREE_TRIAL_USAGE_LIMIT,
      },
    });

    await trackWorkflowReply(message.id, mailbox.slug, organization.id);
    expect(setPrivateMetadata).toHaveBeenCalledWith(organization.id, {
      automatedRepliesCount: SUBSCRIPTION_FREE_TRIAL_USAGE_LIMIT,
    });

    expect(sendEmail).toHaveBeenCalledWith({
      from: "Helper <help@helper.ai>",
      to: [user.emailAddresses[0]?.emailAddress],
      subject: "Automated replies limit exceeded",
      react: "Mock component",
    });
    expect(AutomatedRepliesLimitExceededEmail).toHaveBeenCalledWith({ mailboxSlug: mailbox.slug });
    expect(sendEmail).toHaveBeenCalledTimes(1);
    expect(billWorkflowReply).toHaveBeenCalledTimes(0);
    expect(isBillable).toHaveBeenCalledTimes(0);
    expect(setPrivateMetadata).toHaveBeenCalledWith(organization.id, {
      automatedRepliesLimitExceededAt: expect.any(String),
    });
  });
});
