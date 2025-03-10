import { getBaseUrl } from "@/components/constants";

export const REQUIRED_SCOPES = ["repo", "user"];
export const GITHUB_REDIRECT_URI = `${getBaseUrl()}/api/connect/github/callback`;
