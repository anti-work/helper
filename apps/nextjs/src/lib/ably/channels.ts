export const conversationsListChannelId = (mailboxSlug: string) => `${mailboxSlug}:conversations`;

export const conversationChannelId = (mailboxSlug: string, conversationSlug: string) =>
  `${mailboxSlug}:conversation-${conversationSlug}`;

export const dashboardChannelId = (mailboxSlug: string) => `${mailboxSlug}:dashboard`;
