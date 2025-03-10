import { TRPCError } from "@trpc/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import { conversationMessages, conversations } from "@/db/schema";
import { createGitHubIssue, getGitHubIssue, listRepositoryIssues, updateGitHubIssueState } from "@/lib/github/client";
import { mailboxProcedure } from "./procedure";

export const githubConversationsRouter = {
  createGitHubIssue: mailboxProcedure
    .input(
      z.object({
        conversationSlug: z.string(),
        title: z.string(),
        body: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const conversation = await db.query.conversations.findFirst({
        where: and(eq(conversations.mailboxId, ctx.mailbox.id), eq(conversations.slug, input.conversationSlug)),
      });

      if (!conversation) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Conversation not found",
        });
      }

      if (!ctx.mailbox.githubAccessToken || !ctx.mailbox.githubRepoOwner || !ctx.mailbox.githubRepoName) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "GitHub is not configured for this mailbox",
        });
      }

      try {
        const { issueNumber, issueUrl, issueId } = await createGitHubIssue({
          accessToken: ctx.mailbox.githubAccessToken,
          owner: ctx.mailbox.githubRepoOwner,
          repo: ctx.mailbox.githubRepoName,
          title: input.title,
          body: input.body,
        });

        // Update the conversation with GitHub issue details
        await db
          .update(conversations)
          .set({
            githubIssueNumber: issueNumber,
            githubIssueUrl: issueUrl,
            githubRepoOwner: ctx.mailbox.githubRepoOwner,
            githubRepoName: ctx.mailbox.githubRepoName,
          })
          .where(eq(conversations.id, conversation.id));

        // Add a message to the conversation about the GitHub issue
        await db.insert(conversationMessages).values({
          conversationId: conversation.id,
          body: `Created GitHub issue #${issueNumber}: ${input.title}\n\n${issueUrl}`,
          role: "workflow" as const,
          isPerfect: true,
          isFlaggedAsBad: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        });

        return {
          issueNumber,
          issueUrl,
          issueId,
        };
      } catch (error) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error instanceof Error ? error.message : "Failed to create GitHub issue",
        });
      }
    }),

  updateGitHubIssueState: mailboxProcedure
    .input(
      z.object({
        conversationSlug: z.string(),
        state: z.enum(["open", "closed"]),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const conversation = await db.query.conversations.findFirst({
        where: and(eq(conversations.mailboxId, ctx.mailbox.id), eq(conversations.slug, input.conversationSlug)),
      });

      if (!conversation) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Conversation not found",
        });
      }

      if (!conversation.githubIssueNumber || !conversation.githubRepoOwner || !conversation.githubRepoName) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "No GitHub issue is linked to this conversation",
        });
      }

      if (!ctx.mailbox.githubAccessToken) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "GitHub is not configured for this mailbox",
        });
      }

      try {
        const result = await updateGitHubIssueState({
          accessToken: ctx.mailbox.githubAccessToken,
          owner: conversation.githubRepoOwner,
          repo: conversation.githubRepoName,
          issueNumber: conversation.githubIssueNumber,
          state: input.state,
        });

        // Add a message to the conversation about the GitHub issue state change
        const actionText = input.state === "open" ? "reopened" : "closed";
        await db.insert(conversationMessages).values({
          conversationId: conversation.id,
          body: `GitHub issue #${conversation.githubIssueNumber} has been ${actionText}.`,
          role: "workflow" as const,
          isPerfect: true,
          isFlaggedAsBad: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        });

        // Update conversation status to match GitHub issue state
        await db
          .update(conversations)
          .set({
            status: input.state === "open" ? "open" : "closed",
          })
          .where(eq(conversations.id, conversation.id));

        return {
          state: result.state,
          issueUrl: result.issueUrl,
          issueNumber: conversation.githubIssueNumber,
        };
      } catch (error) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error instanceof Error ? error.message : "Failed to update GitHub issue state",
        });
      }
    }),

  linkExistingGitHubIssue: mailboxProcedure
    .input(
      z.object({
        conversationSlug: z.string(),
        issueNumber: z.number(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const conversation = await db.query.conversations.findFirst({
        where: and(eq(conversations.mailboxId, ctx.mailbox.id), eq(conversations.slug, input.conversationSlug)),
      });

      if (!conversation) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Conversation not found",
        });
      }

      if (!ctx.mailbox.githubAccessToken || !ctx.mailbox.githubRepoOwner || !ctx.mailbox.githubRepoName) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "GitHub is not configured for this mailbox",
        });
      }

      try {
        // Verify the issue exists
        const issue = await getGitHubIssue({
          accessToken: ctx.mailbox.githubAccessToken,
          owner: ctx.mailbox.githubRepoOwner,
          repo: ctx.mailbox.githubRepoName,
          issueNumber: input.issueNumber,
        });

        // Update the conversation with GitHub issue details
        await db
          .update(conversations)
          .set({
            githubIssueNumber: issue.number,
            githubIssueUrl: issue.url,
            githubRepoOwner: ctx.mailbox.githubRepoOwner,
            githubRepoName: ctx.mailbox.githubRepoName,
          })
          .where(eq(conversations.id, conversation.id));

        // Add a message to the conversation about the GitHub issue
        await db.insert(conversationMessages).values({
          conversationId: conversation.id,
          body: `Linked to GitHub issue #${issue.number}: ${issue.title}\n\n${issue.url}`,
          role: "workflow" as const,
          isPerfect: true,
          isFlaggedAsBad: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        });

        return {
          issueNumber: issue.number,
          issueUrl: issue.url,
        };
      } catch (error) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error instanceof Error ? error.message : "Failed to link GitHub issue",
        });
      }
    }),

  listRepositoryIssues: mailboxProcedure
    .input(
      z.object({
        state: z.enum(["open", "closed", "all"]).default("open"),
        mailboxSlug: z.string(),
      }),
    )
    .query(async ({ ctx, input }) => {
      if (!ctx.mailbox.githubAccessToken || !ctx.mailbox.githubRepoOwner || !ctx.mailbox.githubRepoName) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "GitHub is not configured for this mailbox",
        });
      }

      try {
        return await listRepositoryIssues({
          accessToken: ctx.mailbox.githubAccessToken,
          owner: ctx.mailbox.githubRepoOwner,
          repo: ctx.mailbox.githubRepoName,
          state: input.state,
        });
      } catch (error) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error instanceof Error ? error.message : "Failed to list repository issues",
        });
      }
    }),
};
