import { env } from "@/env";

export const HELPER_SUPPORT_MAILBOX_ID = 4;
export const HELPER_SUPPORT_EMAIL_FROM = "help@helper.ai";

export const EMAIL_UNDO_COUNTDOWN_SECONDS = 15;

export const MAX_STYLE_LINTERS = 10;

export const SUBSCRIPTION_FREE_TRIAL_USAGE_LIMIT = 100;

export const DEFAULT_CONVERSATIONS_PER_PAGE = 25;

export const getBaseUrl = () => {
  if (typeof window !== "undefined") return window.location.origin;
  return env.VERCEL_ENV === "preview" ? `https://${env.VERCEL_URL}` : env.AUTH_URL;
};
