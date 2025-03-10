ALTER TABLE "conversations_conversation" ADD COLUMN "github_issue_number" integer;--> statement-breakpoint
ALTER TABLE "conversations_conversation" ADD COLUMN "github_issue_url" text;--> statement-breakpoint
ALTER TABLE "conversations_conversation" ADD COLUMN "github_repo_owner" text;--> statement-breakpoint
ALTER TABLE "conversations_conversation" ADD COLUMN "github_repo_name" text;--> statement-breakpoint
ALTER TABLE "mailboxes_mailbox" ADD COLUMN "github_access_token" text;--> statement-breakpoint
ALTER TABLE "mailboxes_mailbox" ADD COLUMN "github_username" text;--> statement-breakpoint
ALTER TABLE "mailboxes_mailbox" ADD COLUMN "github_repo_owner" text;--> statement-breakpoint
ALTER TABLE "mailboxes_mailbox" ADD COLUMN "github_repo_name" text;