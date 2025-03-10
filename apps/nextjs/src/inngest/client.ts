import { sentryMiddleware } from "@inngest/middleware-sentry";
import { EventSchemas, Inngest } from "inngest";
import type Stripe from "stripe";
import { z } from "zod";
import { searchSchema } from "@/lib/data/conversation/search";

export const assignEventSchema = z.object({
  assignedToId: z.string().nullable(),
  message: z.string().nullable(),
  assignedById: z.string().nullable(),
});

export type AssignEvent = z.infer<typeof assignEventSchema>;

type StripeWebhookEvent = {
  name: "stripe/webhook";
  data: {
    stripeEvent: Stripe.Event;
  };
};

// Chain non-Zod events here like X | Y | Z
type NonZodEvents = StripeWebhookEvent;

export const inngest = new Inngest({
  id: "helper",
  schemas: new EventSchemas()
    .fromZod({
      "files/preview.generate": {
        data: z.object({
          fileId: z.number(),
        }),
      },
      "conversations/embedding.create": {
        data: z.object({
          conversationSlug: z.string(),
        }),
      },
      "conversations/topic.assign": {
        data: z.object({
          conversationId: z.number(),
        }),
      },
      "conversations/message.created": {
        data: z.object({
          messageId: z.number(),
        }),
      },
      "conversations/bulk-index-messages": {
        data: z.object({
          fromMessageId: z.number(),
          toMessageId: z.number(),
        }),
      },
      "conversations/email.enqueued": {
        data: z.object({
          messageId: z.number(),
        }),
      },
      "conversations/auto-response.create": {
        data: z.object({
          messageId: z.number(),
        }),
      },
      "conversations/bulk-update": {
        data: z.object({
          mailboxId: z.number(),
          userId: z.string(),
          conversationFilter: z.union([z.array(z.number()), searchSchema]),
          status: z.enum(["open", "closed", "spam"]),
        }),
      },
      "gmail/webhook.received": {
        data: z.object({
          body: z.any(),
          headers: z.any(),
        }),
      },
      "faqs/embedding.create": {
        data: z.object({
          faqId: z.number(),
        }),
      },
      "conversations/draft.refresh": {
        data: z.object({
          conversationSlug: z.string(),
        }),
      },
      "conversations/assigned": {
        data: z.object({
          conversationId: z.number(),
          assignEvent: assignEventSchema,
        }),
      },
      "gmail/import-recent-threads": {
        data: z.object({
          gmailSupportEmailId: z.number(),
        }),
      },
      "gmail/import-gmail-threads": {
        data: z.object({
          gmailSupportEmailId: z.number(),
          fromInclusive: z.string().datetime(),
          toInclusive: z.string().datetime(),
        }),
      },
      "organization/created": {
        data: z.object({
          organizationId: z.string(),
        }),
      },
      "reports/weekly": {
        data: z.object({
          mailboxId: z.number(),
        }),
      },
      "reports/daily": {
        data: z.object({
          mailboxId: z.number(),
        }),
      },
      "websites/crawl.create": {
        data: z.object({
          websiteId: z.number(),
          crawlId: z.number(),
        }),
      },
      "conversations/check-resolution": {
        data: z.object({
          conversationId: z.number(),
          messageId: z.number(),
        }),
      },
      "messages/flagged.bad": {
        data: z.object({
          messageId: z.number(),
          reason: z.string().nullable(),
        }),
      },
      "conversations/human-support-requested": {
        data: z.object({
          mailboxSlug: z.string(),
          conversationId: z.number(),
        }),
      },
    })
    .fromUnion<NonZodEvents>(),
  middleware: [sentryMiddleware()],
});
