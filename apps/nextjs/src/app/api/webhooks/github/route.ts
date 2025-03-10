import crypto from "crypto";
import * as Sentry from "@sentry/nextjs";
import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db/client";
import { conversationMessages, conversations, mailboxes } from "@/db/schema";
import { env } from "@/env";

// Verify GitHub webhook signature
const verifyGitHubWebhook = (payload: string, signature: string | null) => {
  if (!signature) return false;

  const hmac = crypto.createHmac("sha256", env.GITHUB_CLIENT_SECRET);
  const digest = `sha256=${hmac.update(payload).digest("hex")}`;

  return crypto.timingSafeEqual(Buffer.from(digest), Buffer.from(signature));
};

export async function POST(request: Request) {
  const payload = await request.text();
  const signature = request.headers.get("x-hub-signature-256");

  // Log webhook event for debugging
  console.log(`GitHub webhook received: ${new Date().toISOString()}`);

  // Verify webhook signature
  if (!verifyGitHubWebhook(payload, signature)) {
    console.error("Invalid GitHub webhook signature");
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  try {
    const data = JSON.parse(payload);
    const event = request.headers.get("x-github-event");
    console.log(`GitHub webhook action: ${data.action}, event: ${event}`);

    // Handle issue events
    if (event === "issues" && (data.action === "closed" || data.action === "reopened" || data.action === "opened")) {
      const issueNumber = data.issue.number;
      const repoFullName = data.repository.full_name;
      const [repoOwner, repoName] = repoFullName.split("/");

      console.log(`Processing GitHub issue #${issueNumber} ${data.action} from ${repoFullName}`);

      // Find the conversation with this issue
      const conversation = await db.query.conversations.findFirst({
        where: and(
          eq(conversations.githubIssueNumber, issueNumber),
          eq(conversations.githubRepoOwner, repoOwner),
          eq(conversations.githubRepoName, repoName),
        ),
      });

      if (conversation) {
        console.log(`Found matching conversation ID: ${conversation.id}`);

        if (data.action === "closed") {
          // Update the conversation status to closed
          await db.update(conversations).set({ status: "closed" }).where(eq(conversations.id, conversation.id));
          console.log(`Updated conversation ${conversation.id} status to closed`);

          // Add a message to the conversation that the issue was closed
          await db.insert(conversationMessages).values({
            conversationId: conversation.id,
            body: `GitHub issue #${issueNumber} has been closed.`,
            role: "workflow",
            isPerfect: true,
            isFlaggedAsBad: false,
            createdAt: new Date(),
            updatedAt: new Date(),
          });
          console.log(`Added closed message to conversation ${conversation.id}`);
        } else if (data.action === "reopened" || data.action === "opened") {
          // Update the conversation status to open
          await db.update(conversations).set({ status: "open" }).where(eq(conversations.id, conversation.id));
          console.log(`Updated conversation ${conversation.id} status to open`);

          // Add a message to the conversation that the issue was reopened/opened
          const actionText = data.action === "reopened" ? "reopened" : "opened";
          await db.insert(conversationMessages).values({
            conversationId: conversation.id,
            body: `GitHub issue #${issueNumber} has been ${actionText}.`,
            role: "workflow",
            isPerfect: true,
            isFlaggedAsBad: false,
            createdAt: new Date(),
            updatedAt: new Date(),
          });
          console.log(`Added ${actionText} message to conversation ${conversation.id}`);
        }
      } else {
        console.log(`No matching conversation found for GitHub issue #${issueNumber} in ${repoFullName}`);
      }
    } else {
      console.log(`Ignoring unsupported GitHub webhook: ${data.action}`);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error processing GitHub webhook:", error);
    Sentry.captureException(error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
