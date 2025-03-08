import { userFactory } from "@tests/support/factories/users";
import { describe, expect, it, vi } from "vitest";
import { takeUniqueOrThrow } from "@/components/utils/arrays";
import { db } from "@/db/client";
import { gmailSupportEmails } from "@/db/schema";
import { env } from "@/env";
import { createStripeCheckoutSessionUrl } from "@/lib/data/subscription";
import { stripe } from "@/lib/stripe/client";

vi.mock("@/lib/stripe/client", () => ({
  stripe: {
    checkout: {
      sessions: {
        create: vi.fn().mockResolvedValue({ url: "https://mocked.url" }),
      },
    },
    subscriptions: {
      update: vi.fn().mockResolvedValue({ cancel_at_period_end: true }),
    },
  },
}));

vi.mock("@/env", async () => {
  const { env } = await import("@/env");
  return {
    env: {
      ...env,
      AUTH_URL: "http://localhost:3010",
      STRIPE_FIXED_PRICE_ID: "price_123",
      STRIPE_GRADUATED_PRICE_ID: "price_456",
    },
  };
});

describe("createStripeCheckoutSessionUrl", () => {
  it("returns a Stripe checkout URL", async () => {
    const { organization, mailbox } = await userFactory.createRootUser();

    expect(
      await createStripeCheckoutSessionUrl({
        gmailSupportEmailId: null,
        slug: mailbox.slug,
        clerkOrganizationId: organization.id,
      }),
    ).toBe("https://mocked.url");

    const baseExpectedArgs = {
      client_reference_id: organization.id.toString(),
      mode: "subscription",
      line_items: [{ price: env.STRIPE_PRICE_ID }],
      success_url: `http://localhost:3010/mailboxes/${mailbox.slug}/settings?tab=billing&stripeStatus=success&stripeSessionId={CHECKOUT_SESSION_ID}`,
      cancel_url: `http://localhost:3010/mailboxes/${mailbox.slug}/settings?tab=billing`,
    };

    expect(stripe.checkout.sessions.create).toHaveBeenCalledWith({
      ...baseExpectedArgs,
      customer_email: undefined,
    });

    const gmailSupportEmail = await db
      .insert(gmailSupportEmails)
      .values({
        email: "test@example.com",
        createdAt: new Date(),
        updatedAt: new Date(),
        accessToken: "access_token",
        refreshToken: "refresh_token",
      })
      .returning()
      .then(takeUniqueOrThrow);

    expect(
      await createStripeCheckoutSessionUrl({
        gmailSupportEmailId: gmailSupportEmail.id,
        slug: mailbox.slug,
        clerkOrganizationId: organization.id,
      }),
    ).toBe("https://mocked.url");
    expect(stripe.checkout.sessions.create).toHaveBeenCalledWith({
      ...baseExpectedArgs,
      customer_email: "test@example.com",
    });
  });
});
