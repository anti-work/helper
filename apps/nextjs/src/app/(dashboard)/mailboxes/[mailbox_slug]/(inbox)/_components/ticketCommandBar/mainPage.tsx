import {
  ArrowUturnLeftIcon,
  ArrowUturnUpIcon,
  ChatBubbleLeftIcon,
  EnvelopeIcon,
  ListBulletIcon,
  PencilSquareIcon,
  PlayIcon,
  ShieldExclamationIcon,
  SparklesIcon,
  UserIcon,
} from "@heroicons/react/24/outline";
import { useMemo } from "react";
import { useConversationContext } from "@/app/(dashboard)/mailboxes/[mailbox_slug]/(inbox)/_components/conversationContext";
import useKeyboardShortcut from "@/components/useKeyboardShortcut";
import { useToolExecution } from "@/hooks/useToolExecution";
import { api } from "@/trpc/react";
import GitHubSvg from "../../_components/icons/github.svg";
import { CommandGroup } from "./types";

type MainPageProps = {
  onGenerateDraft: () => void;
  onOpenChange: (open: boolean) => void;
  setPage: (page: "main" | "previous-replies" | "assignees" | "notes" | "tools" | "github-issue") => void;
  setSelectedItemId: (id: string | null) => void;
  onToggleCc: () => void;
};

export const useMainPage = ({
  onGenerateDraft,
  onOpenChange,
  setPage,
  setSelectedItemId,
  onToggleCc,
}: MainPageProps): CommandGroup[] => {
  const { data: conversation, updateStatus, mailboxSlug, conversationSlug, refetch } = useConversationContext();

  const { handleToolExecution } = useToolExecution();

  const { data: tools } = api.mailbox.conversations.tools.list.useQuery(
    { mailboxSlug, conversationSlug },
    { staleTime: Infinity, refetchOnMount: false, refetchOnWindowFocus: false, enabled: !!conversationSlug },
  );

  const { data: mailbox } = api.mailbox.get.useQuery(
    { mailboxSlug },
    { staleTime: Infinity, refetchOnMount: false, refetchOnWindowFocus: false, enabled: !!mailboxSlug },
  );

  const isGitHubConnected = mailbox?.githubConnected && mailbox.githubRepoOwner && mailbox.githubRepoName;

  useKeyboardShortcut("n", (e) => {
    e.preventDefault();
    onOpenChange(true);
    setPage("notes");
    setSelectedItemId(null);
  });

  const mainCommandGroups = useMemo(
    () => [
      {
        heading: "Actions",
        items: [
          {
            id: "close",
            label: "Close ticket",
            icon: ArrowUturnLeftIcon,
            onSelect: () => {
              updateStatus("closed");
              onOpenChange(false);
            },
            shortcut: "C",
            preview: (
              <div className="p-4">
                <h3 className="font-medium mb-2">Close Ticket</h3>
                <p className="text-sm text-muted-foreground">
                  Mark this conversation as resolved and move it to the closed state.
                </p>
              </div>
            ),
            hidden: conversation?.status === "closed" || conversation?.status === "spam",
          },
          {
            id: "reopen",
            label: "Reopen ticket",
            icon: ArrowUturnUpIcon,
            onSelect: () => {
              updateStatus("open");
              onOpenChange(false);
            },
            shortcut: "Z",
            preview: (
              <div className="p-4">
                <h3 className="font-medium mb-2">Reopen Ticket</h3>
                <p className="text-sm text-muted-foreground">Set this conversation back to the open state.</p>
              </div>
            ),
            hidden: conversation?.status === "open",
          },
          {
            id: "assign",
            label: "Assign ticket",
            icon: UserIcon,
            onSelect: () => {
              setPage("assignees");
              setSelectedItemId(null);
            },
            shortcut: "A",
            preview: (
              <div className="p-4">
                <h3 className="font-medium mb-2">Assign Ticket</h3>
                <p className="text-sm text-muted-foreground">
                  Transfer ownership of this conversation to another team member.
                </p>
              </div>
            ),
          },
          {
            id: "spam",
            label: "Mark as spam",
            icon: ShieldExclamationIcon,
            onSelect: () => {
              updateStatus("spam");
              onOpenChange(false);
            },
            shortcut: "S",
            preview: (
              <div className="p-4">
                <h3 className="font-medium mb-2">Mark as Spam</h3>
                <p className="text-sm text-muted-foreground">
                  Mark this conversation as spam and move it to the spam folder.
                </p>
              </div>
            ),
            hidden: conversation?.status === "spam",
          },
          {
            id: "add-note",
            label: "Add internal note",
            icon: PencilSquareIcon,
            onSelect: () => {
              setPage("notes");
              setSelectedItemId(null);
            },
            shortcut: "N",
            preview: (
              <div className="p-4">
                <h3 className="font-medium mb-2">Add Internal Note</h3>
                <p className="text-sm text-muted-foreground">
                  Add a private note to this conversation that is only visible to your team.
                </p>
              </div>
            ),
          },
          {
            id: "github-issue",
            label: "GitHub Issue",
            icon: GitHubSvg,
            onSelect: () => {
              setPage("github-issue");
              setSelectedItemId(null);
            },
            shortcut: "G",
            preview: (
              <div className="p-4">
                <h3 className="font-medium mb-2">GitHub Issue</h3>
                {(conversation as any)?.githubIssueNumber ? (
                  <>
                    <p className="text-sm text-muted-foreground mb-2">
                      This conversation is linked to GitHub issue #{(conversation as any).githubIssueNumber}.
                    </p>
                    <p className="text-sm text-muted-foreground">You can view the issue details, close or reopen it.</p>
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Create a new GitHub issue or link an existing one to this conversation.
                  </p>
                )}
              </div>
            ),
            hidden: !isGitHubConnected,
          },
        ],
      },
      {
        heading: "Compose",
        items: [
          {
            id: "generate-draft",
            label: "Generate draft",
            icon: SparklesIcon,
            onSelect: () => {
              onGenerateDraft();
              onOpenChange(false);
            },
            preview: (
              <div className="p-4">
                <h3 className="font-medium mb-2">Generate AI Draft</h3>
                <p className="text-sm text-muted-foreground">
                  Use AI to generate a response based on the conversation context and your previous replies.
                </p>
              </div>
            ),
          },
          {
            id: "previous-replies",
            label: "Use previous replies",
            icon: ChatBubbleLeftIcon,
            onSelect: () => {
              setPage("previous-replies");
              setSelectedItemId(null);
            },
            preview: (
              <div className="p-4">
                <h3 className="font-medium mb-2">Previous Replies</h3>
                <p className="text-sm text-muted-foreground">
                  Browse and reuse responses from your previous conversations to maintain consistency.
                </p>
              </div>
            ),
          },
          {
            id: "toggle-cc-bcc",
            label: "Add CC or BCC",
            icon: EnvelopeIcon,
            onSelect: () => {
              onToggleCc();
              onOpenChange(false);
            },
            preview: (
              <div className="p-4">
                <h3 className="font-medium mb-2">Add CC or BCC</h3>
                <p className="text-sm text-muted-foreground">
                  Show CC and BCC fields to add recipients to the email reply.
                </p>
              </div>
            ),
          },
        ],
      },
      ...(tools && (tools.recommended.length > 0 || tools.all.length > 0)
        ? [
            {
              heading: "Tools",
              items: [
                ...tools.recommended.map((tool) => ({
                  id: `tool-${tool.slug}-${JSON.stringify(tool.parameters)}`,
                  label: tool.name,
                  icon: PlayIcon,
                  onSelect: () => {
                    void handleToolExecution(tool.slug, tool.name, tool.parameters);
                    onOpenChange(false);
                  },
                  preview: (
                    <div className="p-4">
                      <h3 className="font-medium mb-2">{tool.name}</h3>
                      <p className="text-sm text-muted-foreground">{tool.description}</p>
                      {tool.parameters && Object.keys(tool.parameters).length > 0 && (
                        <div className="mt-4">
                          <h4 className="font-medium mb-1">Parameters</h4>
                          <div className="text-sm text-muted-foreground">
                            {Object.entries(tool.parameters).map(([name, value]) => (
                              <div key={name} className="flex gap-1">
                                <span>{name}:</span>
                                <span className="truncate font-mono" title={JSON.stringify(value)}>
                                  {JSON.stringify(value)}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ),
                })),
                {
                  id: "all-tools",
                  label: "All tools",
                  icon: ListBulletIcon,
                  preview: (
                    <div className="p-4">
                      <h3 className="font-medium mb-2">All Tools</h3>
                      <p className="text-sm text-muted-foreground">
                        Browse and call any available tool with any parameters.
                      </p>
                    </div>
                  ),
                  onSelect: () => {
                    setPage("tools");
                    setSelectedItemId(null);
                  },
                },
              ],
            },
          ]
        : []),
    ],
    [
      conversation?.status,
      updateStatus,
      onOpenChange,
      setPage,
      setSelectedItemId,
      tools,
      handleToolExecution,
      onToggleCc,
      onGenerateDraft,
      isGitHubConnected,
    ],
  );

  return mainCommandGroups;
};
