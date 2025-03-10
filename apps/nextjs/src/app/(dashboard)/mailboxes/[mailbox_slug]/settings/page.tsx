import { revalidatePath } from "next/cache";
import { PageContainer } from "@/components/pageContainer";
import { api } from "@/trpc/server";
import { getSidebarInfo } from "../_components/getSidebarInfo";
import Settings, { type PendingUpdates } from "./_components/settings";

type PageProps = {
  mailbox_slug: string;
};

const Page = async (props: { params: Promise<PageProps> }) => {
  const params = await props.params;
  const mailboxPath = `/mailboxes/${params.mailbox_slug}` as const;
  const settingsPath = `${mailboxPath}/settings` as const;

  const [workflowsData, supportAccount, mailboxData, lintersData, sidebarInfo] = await Promise.all([
    api.mailbox.workflows.list({ mailboxSlug: params.mailbox_slug }),
    api.gmailSupportEmail.get({ mailboxSlug: params.mailbox_slug }),
    api.mailbox.get({ mailboxSlug: params.mailbox_slug }),
    api.mailbox.styleLinters.list({ mailboxSlug: params.mailbox_slug }),
    getSidebarInfo(params.mailbox_slug),
  ]);

  const handleUpdateSettings = async (pendingUpdates: PendingUpdates) => {
    "use server";

    if (pendingUpdates.slack) {
      try {
        await api.mailbox.update({
          mailboxSlug: params.mailbox_slug,
          slackAlertChannel: pendingUpdates.slack.alertChannel ?? undefined,
        });
      } catch (e) {
        throw new Error("Failed to update Slack settings");
      }
    }

    if (pendingUpdates.github) {
      try {
        await api.mailbox.update({
          mailboxSlug: params.mailbox_slug,
          githubRepoOwner: pendingUpdates.github.repoOwner ?? undefined,
          githubRepoName: pendingUpdates.github.repoName ?? undefined,
        });
      } catch (e) {
        throw new Error("Failed to update GitHub settings");
      }
    }

    if (pendingUpdates.promptLines) {
      try {
        const currentPrompt = await api.mailbox.get({ mailboxSlug: params.mailbox_slug });
        const updatePromptLines = [...currentPrompt.responseGeneratorPrompt];
        pendingUpdates.promptLines.forEach((line) => {
          if (line.lineIndex !== undefined && line.content) {
            updatePromptLines[line.lineIndex] = line.content;
          }
        });

        await api.mailbox.update({
          mailboxSlug: params.mailbox_slug,
          responseGeneratorPrompt: updatePromptLines,
        });
      } catch (e) {
        throw new Error("Failed to update prompt lines");
      }
    }

    if (pendingUpdates.widget) {
      await api.mailbox.update({
        mailboxSlug: params.mailbox_slug,
        widgetDisplayMode: pendingUpdates.widget.displayMode ?? undefined,
        widgetDisplayMinValue: pendingUpdates.widget.displayMinValue ?? undefined,
        autoRespondEmailToChat: pendingUpdates.widget.autoRespondEmailToChat ?? undefined,
        widgetHost: pendingUpdates.widget.widgetHost ?? undefined,
      });
    }

    if (pendingUpdates.customer) {
      await api.mailbox.update({
        mailboxSlug: params.mailbox_slug,
        vipThreshold: pendingUpdates.customer.vipThreshold ? Number(pendingUpdates.customer.vipThreshold) : undefined,
        vipChannelId: pendingUpdates.customer.vipChannelId ?? undefined,
        vipExpectedResponseHours: pendingUpdates.customer.vipExpectedResponseHours ?? undefined,
        disableAutoResponseForVips: pendingUpdates.customer.disableAutoResponseForVips ?? false,
      });
    }

    revalidatePath(settingsPath);
  };

  const deleteWorkflow = async (id: number) => {
    "use server";

    await api.mailbox.workflows.delete({ mailboxSlug: params.mailbox_slug, id });

    revalidatePath(settingsPath);
    return null;
  };

  return (
    <PageContainer>
      <title>Settings</title>
      <Settings
        mailbox={mailboxData}
        linters={lintersData}
        workflows={workflowsData}
        handleDeleteWorkflow={deleteWorkflow}
        onUpdateSettings={handleUpdateSettings}
        supportAccount={supportAccount ?? undefined}
        subscription={mailboxData.subscription}
        sidebarInfo={sidebarInfo}
      />
    </PageContainer>
  );
};

export default Page;
