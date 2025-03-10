import { auth } from "@clerk/nextjs/server";
import * as Sentry from "@sentry/nextjs";
import { eq } from "drizzle-orm";
import { NextResponse, type NextRequest } from "next/server";
import { getBaseUrl } from "@/components/constants";
import { db } from "@/db/client";
import { mailboxes } from "@/db/schema";
import { getGitHubAccessToken } from "@/lib/github/client";
import { getAuthorizedMailbox } from "@/trpc";

export async function GET(request: NextRequest) {
  const state = JSON.parse(request.nextUrl.searchParams.get("state") || "{}");
  const code = request.nextUrl.searchParams.get("code");
  const redirectUrl = new URL(`${getBaseUrl()}/mailboxes/${state.mailbox_slug}/settings`);

  if (!code) {
    return NextResponse.redirect(`${redirectUrl}?tab=integrations&githubConnectResult=error`);
  }

  const session = await auth();
  if (!session?.userId || !session.orgId) {
    return NextResponse.redirect(`${redirectUrl}?tab=integrations&githubConnectResult=error`);
  }

  try {
    const mailbox = await getAuthorizedMailbox(session.orgId, state.mailbox_slug);
    if (!mailbox) {
      return NextResponse.redirect(`${redirectUrl}?tab=integrations&githubConnectResult=error`);
    }

    const { accessToken, username } = await getGitHubAccessToken(code);

    await db
      .update(mailboxes)
      .set({
        githubAccessToken: accessToken,
        githubUsername: username,
      })
      .where(eq(mailboxes.id, mailbox.id));

    return NextResponse.redirect(`${redirectUrl}?tab=integrations&githubConnectResult=success`);
  } catch (error) {
    Sentry.captureException(error);
    return NextResponse.redirect(`${redirectUrl}?tab=integrations&githubConnectResult=error`);
  }
}
