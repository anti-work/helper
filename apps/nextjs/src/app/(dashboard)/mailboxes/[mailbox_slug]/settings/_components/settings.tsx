"use client";

import { useClerk } from "@clerk/nextjs";
import {
  BoltIcon,
  BookOpenIcon,
  ChatBubbleBottomCenterIcon,
  ComputerDesktopIcon,
  CreditCardIcon,
  LinkIcon,
  UserGroupIcon,
} from "@heroicons/react/24/outline";
import { ChevronUp } from "lucide-react";
import React, { useState, useTransition } from "react";
import type { Linter, PromptLineUpdate, Subscription as SubscriptionType, SupportAccount } from "@/app/types/global";
import { FileUploadProvider } from "@/components/fileUploadContext";
import { toast } from "@/components/hooks/use-toast";
import { PageHeader } from "@/components/pageHeader";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { getTauriPlatform } from "@/components/useNativePlatform";
import { mailboxes } from "@/db/schema";
import { RouterOutputs } from "@/trpc";
import { SidebarInfo } from "../../_components/getSidebarInfo";
import WorkflowsSetting, { type Workflow } from "./automaticWorkflowsSetting";
import ChatWidgetSetting from "./chatWidgetSetting";
import ConnectSupportEmail from "./connectSupportEmail";
import CustomerSetting, { type CustomerUpdates } from "./customerSetting";
import GitHubSetting, { type GitHubUpdates } from "./githubSetting";
import KnowledgeSetting from "./knowledgeSetting";
import MetadataEndpointSetting from "./metadataEndpointSetting";
import PromptSetting from "./promptSetting";
import SlackSetting, { type SlackUpdates } from "./slackSetting";
import StyleLinterSetting from "./styleLinterSetting";
import SubNavigation from "./subNavigation";
import Subscription from "./subscription";
import ToolSetting from "./toolSetting";

export type PendingUpdates = {
  slack?: SlackUpdates;
  github?: GitHubUpdates;
  promptLines?: PromptLineUpdate[];
  widget?: {
    displayMode: (typeof mailboxes.$inferSelect)["widgetDisplayMode"];
    displayMinValue?: number;
    autoRespondEmailToChat?: boolean;
    widgetHost?: string;
  };
  customer?: CustomerUpdates;
};

type SettingsProps = {
  children?: React.ReactElement<any> | React.ReactElement<any>[];
  onUpdateSettings: (pendingUpdates: PendingUpdates) => Promise<void>;
  mailbox: RouterOutputs["mailbox"]["get"];
  handleDeleteWorkflow: (id: number) => Promise<string | null>;
  linters: Linter[];
  supportAccount?: SupportAccount;
  workflows: Workflow[];
  subscription: SubscriptionType | null;
  sidebarInfo: SidebarInfo;
};

const Settings = ({
  onUpdateSettings,
  mailbox,
  handleDeleteWorkflow,
  linters,
  supportAccount,
  subscription,
  workflows,
  sidebarInfo,
}: SettingsProps) => {
  const { signOut } = useClerk();
  const [isTransitionPending, startTransition] = useTransition();
  const [isUpdating, setIsUpdating] = useState(false);
  const [pendingUpdates, setPendingUpdates] = useState<PendingUpdates>({});
  const [showBilling] = useState(() => !getTauriPlatform());

  const handleUpdateSettings = async () => {
    if (!hasPendingUpdates) return;

    startTransition(() => setIsUpdating(true));
    try {
      await onUpdateSettings(pendingUpdates);
      setPendingUpdates({});
      toast({
        title: "Settings updated!",
        variant: "success",
      });
    } catch (e) {
      const error = e instanceof Error ? e.message : "Something went wrong";
      toast({
        title: error,
        variant: "destructive",
      });
    } finally {
      setIsUpdating(false);
    }
  };

  const hasPendingUpdates =
    Boolean(pendingUpdates.promptLines?.length) ||
    Boolean(pendingUpdates.slack) ||
    Boolean(pendingUpdates.github) ||
    Boolean(pendingUpdates.widget) ||
    Boolean(pendingUpdates.customer);

  const handleSignOut = async () => {
    try {
      await signOut({ redirectUrl: "/" });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Failed to sign out",
      });
    }
  };

  const items = [
    {
      label: "Workflows",
      id: "workflows",
      icon: BoltIcon,
      content: (
        <WorkflowsSetting mailboxSlug={mailbox.slug} workflows={workflows} handleDelete={handleDeleteWorkflow} />
      ),
    },
    {
      label: "Knowledge",
      id: "knowledge",
      icon: BookOpenIcon,
      content: <KnowledgeSetting />,
    },
    {
      label: "Customers",
      id: "customers",
      icon: UserGroupIcon,
      content: (
        <CustomerSetting
          mailbox={mailbox}
          onChange={(customerChanges) =>
            setPendingUpdates({
              ...pendingUpdates,
              customer: customerChanges,
            })
          }
        />
      ),
    },
    {
      label: "Replies",
      id: "replies",
      icon: ChatBubbleBottomCenterIcon,
      content: (
        <>
          <PromptSetting
            mailboxSlug={mailbox.slug}
            promptLines={mailbox.responseGeneratorPrompt}
            onChange={(changes) => {
              setPendingUpdates({
                ...pendingUpdates,
                promptLines: changes,
              });
            }}
            pendingUpdates={pendingUpdates.promptLines}
          />
          <StyleLinterSetting isLinterEnabled={mailbox.isStyleLinterEnabled} linters={linters} />
        </>
      ),
    },
    {
      label: "In-App Chat",
      id: "in-app-chat",
      icon: ComputerDesktopIcon,
      content: (
        <ChatWidgetSetting
          mailbox={mailbox}
          onChange={(widgetChanges) =>
            setPendingUpdates({
              ...pendingUpdates,
              widget: widgetChanges,
            })
          }
        />
      ),
    },
    {
      label: "Integrations",
      id: "integrations",
      icon: LinkIcon,
      content: (
        <>
          <ToolSetting mailboxSlug={mailbox.slug} />
          <MetadataEndpointSetting metadataEndpoint={mailbox.metadataEndpoint} />
          <SlackSetting
            mailbox={mailbox}
            onChange={(slackChanges) =>
              setPendingUpdates({
                ...pendingUpdates,
                slack: { ...pendingUpdates.slack, ...slackChanges },
              })
            }
          />
          <GitHubSetting
            mailbox={mailbox}
            onChange={(githubChanges) =>
              setPendingUpdates({
                ...pendingUpdates,
                github: { ...pendingUpdates.github, ...githubChanges },
              })
            }
          />
          <ConnectSupportEmail supportAccount={supportAccount} />
        </>
      ),
    },
  ];

  if (showBilling) {
    items.push({
      label: "Billing",
      id: "billing",
      icon: CreditCardIcon,
      content: <Subscription />,
    });
  }

  return (
    <div className="flex h-full flex-col">
      <PageHeader title="Settings">
        <Button disabled={isUpdating || isTransitionPending || !hasPendingUpdates} onClick={handleUpdateSettings}>
          Update settings
        </Button>
      </PageHeader>

      <FileUploadProvider mailboxSlug={mailbox.slug}>
        <div className="flex-grow overflow-y-auto">
          <SubNavigation
            items={items}
            footer={
              <div className="border-t border-border">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="flex h-12 w-full items-center gap-2 px-4 text-base text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
                      <Avatar fallback={sidebarInfo.avatarName ?? ""} size="sm" />
                      <span className="flex-grow truncate text-left font-sundry-narrow-medium">
                        {sidebarInfo.loggedInName}
                      </span>
                      <ChevronUp className="h-4 w-4" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent side="top" className="w-[--radix-popper-anchor-width]">
                    <DropdownMenuItem className="cursor-pointer" onClick={handleSignOut}>
                      <span>Sign out</span>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            }
          />
        </div>
      </FileUploadProvider>
    </div>
  );
};

export default Settings;
