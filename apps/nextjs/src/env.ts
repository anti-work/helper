import { createEnv } from "@t3-oss/env-nextjs";
import { vercel } from "@t3-oss/env-nextjs/presets";
import { z } from "zod";

export const env = createEnv({
  extends: [vercel()],
  shared: {
    NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  },
  /**
   * Specify your server-side environment variables schema here.
   * This way you can ensure the app isn't built with invalid env vars.
   */
  server: {
    ABLY_API_KEY: z.string().min(1),
    CRYPTO_SECRET: z.string().min(1),
    POSTGRES_URL: z.string().url(),
    POSTGRES_URL_NON_POOLING: z.string().url(),
    GOOGLE_CLIENT_ID: z.string().min(1),
    GOOGLE_CLIENT_SECRET: z.string().min(1),
    GOOGLE_PUBSUB_TOPIC_NAME: z.string().min(1),
    HELPER_API_KEY: z.string().min(1),
    AUTH_SECRET: z.string().min(1),
    // TODO: Remove the hard-coded default URL once AUTH_URL isn't a required
    // environment variable.
    AUTH_URL: z.string().url().optional().default("https://helper.ai"), // The root URL of the app; called this because next-auth uses it
    NEXT_RUNTIME: z.enum(["nodejs", "edge"]).default("nodejs"),
    RESEND_API_KEY: z.string().min(1),
    SLACK_CLIENT_ID: z.string().min(1),
    SLACK_CLIENT_SECRET: z.string().min(1),
    SLACK_SIGNING_SECRET: z.string().min(1),
    GITHUB_CLIENT_ID: z.string().min(1),
    GITHUB_CLIENT_SECRET: z.string().min(1),
    STRIPE_PRICE_ID: z.string().min(1),
    STRIPE_WEBHOOK_SECRET: z.string().min(1),
    STRIPE_SECRET_KEY: z.string().min(1),
    WIDGET_JWT_SECRET: z.string().min(1),
    AWS_ACCESS_KEY_ID: z.string().min(1),
    AWS_SECRET_ACCESS_KEY: z.string().min(1),
    AWS_DEFAULT_REGION: z.string().min(1),
    AWS_PRIVATE_STORAGE_BUCKET_NAME: z.string().min(1),
    DEMO_MAILBOX_SLUG: z.string().min(1),
    GOOGLE_PUBSUB_CLAIM_EMAIL: z.string().email().min(1),
    ENCRYPT_COLUMN_SECRET: z.string().regex(/^[a-f0-9]{32}$/, "must be a random 32-character hex string"),
    CLERK_SECRET_KEY: z.string().min(1),
    CLERK_SIGN_IN_FALLBACK_REDIRECT_URL: z.string().min(1),
    CLERK_SIGN_UP_FALLBACK_REDIRECT_URL: z.string().min(1),
    CLERK_INITIAL_ORGANIZATION_ID: z
      .string()
      .regex(/^org_\w+$/)
      .optional(),
    CLERK_INITIAL_USER_IDS: z
      .string()
      .regex(/^user_\w+(?:,user_\w+)*$/)
      .optional(),
    // Lets us consider our own org as having a paid subscription
    ADDITIONAL_PAID_ORGANIZATION_IDS: z
      .string()
      .regex(/^org_\w+(?:,org_\w+)*$/)
      .optional(),
    JINA_API_TOKEN: z.string().min(1),
    LANGFUSE_SECRET_KEY: z.string().min(1),
    LANGFUSE_PUBLIC_KEY: z.string().min(1),
    LANGFUSE_BASEURL: z.string().url().optional(),
    DRIZZLE_LOGGING: z.string().optional(),
    KV_UPSTASH_KV_REST_API_URL: z.string().url(),
    KV_UPSTASH_KV_REST_API_TOKEN: z.string().min(1),
    OPENAI_API_KEY: z.string().min(1),
    FIRECRAWL_API_KEY: z.string().min(1),
    PROXY_URL: z.string().url().optional(),
    PROXY_SECRET_KEY: z.string().min(1).optional(),
  },

  /**
   * Specify your client-side environment variables schema here.
   * For them to be exposed to the client, prefix them with `NEXT_PUBLIC_`.
   */
  client: {
    NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: z.string().min(1),
    NEXT_PUBLIC_CLERK_SIGN_IN_URL: z.string().min(1),
    NEXT_PUBLIC_CLERK_SIGN_UP_URL: z.string().min(1),
    NEXT_PUBLIC_VERCEL_ENV: z.enum(["development", "preview", "production"]),
  },
  /**
   * Destructure all variables from `process.env` to make sure they aren't tree-shaken away.
   */
  experimental__runtimeEnv: {
    NODE_ENV: process.env.NODE_ENV,
    NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
    NEXT_PUBLIC_CLERK_SIGN_IN_URL: process.env.NEXT_PUBLIC_CLERK_SIGN_IN_URL,
    NEXT_PUBLIC_CLERK_SIGN_UP_URL: process.env.NEXT_PUBLIC_CLERK_SIGN_UP_URL,
    NEXT_PUBLIC_VERCEL_ENV: process.env.NEXT_PUBLIC_VERCEL_ENV,
  },
  skipValidation: !!process.env.CI || process.env.npm_lifecycle_event === "lint" || process.env.NODE_ENV === "test",
});
