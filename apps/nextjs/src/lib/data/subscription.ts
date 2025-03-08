import { eq } from "drizzle-orm";
import Stripe from "stripe";
import { getBaseUrl } from "@/components/constants";
import { db } from "@/db/client";
import { gmailSupportEmails, subscriptions } from "@/db/schema";
import { env } from "@/env";
import { stripe } from "@/lib/stripe/client";

export const createStripeCheckoutSessionUrl = async ({
  gmailSupportEmailId,
  slug: mailboxSlug,
  clerkOrganizationId,
}: {
  gmailSupportEmailId: number | null;
  slug: string;
  clerkOrganizationId: string;
}) => {
  const email = gmailSupportEmailId
    ? (
        await db.query.gmailSupportEmails.findFirst({
          where: eq(gmailSupportEmails.id, gmailSupportEmailId),
          columns: {
            email: true,
          },
        })
      )?.email
    : undefined;

  const baseSettingsUrl = new URL(`/mailboxes/${mailboxSlug}/settings`, new URL(getBaseUrl()).origin);
  baseSettingsUrl.searchParams.set("tab", "billing");

  const successUrl = new URL(baseSettingsUrl);
  successUrl.searchParams.set("stripeStatus", "success");

  const stripeSession = await stripe.checkout.sessions.create({
    client_reference_id: clerkOrganizationId,
    mode: "subscription",
    line_items: [{ price: env.STRIPE_PRICE_ID }],
    success_url: `${successUrl.toString()}&stripeSessionId={CHECKOUT_SESSION_ID}`,
    cancel_url: baseSettingsUrl.toString(),
    customer_email: email,
  });

  return stripeSession.url;
};

export const createStripeSubscription = async (session: Stripe.Checkout.Session) => {
  const clerkOrganizationId = session.client_reference_id;
  if (!clerkOrganizationId) {
    throw new Error("`client_reference_id` is required");
  }
  if (!session.subscription) {
    throw new Error("`subscription` is required");
  }

  const stripeSubscriptionId =
    typeof session.subscription === "string" ? session.subscription : session.subscription.id;
  const subscription = await stripe.subscriptions.retrieve(stripeSubscriptionId);
  const stripeCustomerId = typeof subscription.customer === "string" ? subscription.customer : subscription.customer.id;

  const subscriptionInfo = {
    stripeCustomerId,
    stripeSubscriptionId,
    status: "active",
    currentPeriodEnd: new Date(subscription.current_period_end * 1000),
    canceledAt: null,
  };

  await db
    .insert(subscriptions)
    .values({
      clerkOrganizationId,
      ...subscriptionInfo,
    })
    .onConflictDoUpdate({
      target: [subscriptions.clerkOrganizationId],
      set: subscriptionInfo,
    });
};

export const getCurrentBillingPeriodUsage = async (stripeCustomerId: string) => {
  const upcomingInvoice = await stripe.invoices.retrieveUpcoming({ customer: stripeCustomerId });
  const totalUsage = upcomingInvoice.lines.data.reduce((sum, lineItem) => {
    if (lineItem.price?.recurring?.usage_type === "metered") {
      return sum + (lineItem.quantity ?? 0);
    }
    return sum;
  }, 0);
  return totalUsage;
};

export const createStripeCustomerPortalUrl = async (stripeCustomerId: string) => {
  const session = await stripe.billingPortal.sessions.create({
    customer: stripeCustomerId,
    return_url: new URL(getBaseUrl()).origin,
  });
  return session.url;
};
