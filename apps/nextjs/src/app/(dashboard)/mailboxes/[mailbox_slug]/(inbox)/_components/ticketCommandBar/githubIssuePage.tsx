import { ExternalLinkIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "@/components/hooks/use-toast";
import LoadingSpinner from "@/components/loadingSpinner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/trpc/react";
import { useConversationContext } from "../conversationContext";

type GitHubIssuePageProps = {
  onOpenChange: (open: boolean) => void;
};

interface GitHubIssue {
  number: number;
  title: string;
  state: string;
  url: string;
  updatedAt: string;
}

export const GitHubIssuePage = ({ onOpenChange }: GitHubIssuePageProps) => {
  const { mailboxSlug, conversationSlug, data: conversation, refetch: refetchConversation } = useConversationContext();

  const [isCreating, setIsCreating] = useState(false);
  const [isLinking, setIsLinking] = useState(false);
  const [isUpdatingState, setIsUpdatingState] = useState(false);
  const [activeTab, setActiveTab] = useState("create");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [selectedIssueNumber, setSelectedIssueNumber] = useState<number | null>(null);

  const { data: mailbox } = api.mailbox.get.useQuery({ mailboxSlug });

  const { mutateAsync: createIssue } = (api.mailbox.conversations as any).createGitHubIssue.useMutation();
  const { mutateAsync: linkIssue } = (api.mailbox.conversations as any).linkExistingGitHubIssue.useMutation();
  const { mutateAsync: updateIssueState } = (api.mailbox.conversations as any).updateGitHubIssueState.useMutation();

  const { data: issues, isLoading: isLoadingIssues } = (api.mailbox.conversations as any).listRepositoryIssues.useQuery(
    {
      state: "open",
      mailboxSlug,
    },
    {
      enabled: activeTab === "link",
      staleTime: 30000,
    },
  );

  const conversationWithGitHub = conversation as any;
  const hasLinkedIssue = conversationWithGitHub?.githubIssueNumber && conversationWithGitHub?.githubIssueUrl;
  const issueNumber = hasLinkedIssue ? conversationWithGitHub.githubIssueNumber : null;
  const issueUrl = hasLinkedIssue ? conversationWithGitHub.githubIssueUrl : null;
  const issueState = conversationWithGitHub?.githubIssueState || "open";
  const isIssueClosed = issueState === "closed";

  // Set initial values when conversation data is loaded
  useEffect(() => {
    if (conversation) {
      setTitle(conversation.subject || "");
      setBody(
        typeof conversation.summary === "string"
          ? conversation.summary
          : Array.isArray(conversation.summary)
            ? conversation.summary.join("\n\n")
            : "",
      );

      if (hasLinkedIssue) {
        setActiveTab("view");
      }
    }
  }, [conversation, hasLinkedIssue]);

  const handleCreateIssue = async () => {
    if (!mailbox?.githubConnected || !mailbox.githubRepoOwner || !mailbox.githubRepoName) {
      toast({
        title: "GitHub repository not configured",
        description: "Please configure a GitHub repository in the mailbox settings.",
        variant: "destructive",
      });
      return;
    }

    setIsCreating(true);
    try {
      const result = await createIssue({
        mailboxSlug,
        conversationSlug,
        title,
        body,
      });

      toast({
        title: "GitHub issue created",
        description: (
          <a href={result.issueUrl} target="_blank" rel="noopener noreferrer" className="underline">
            View issue #{result.issueNumber}
          </a>
        ),
        variant: "success",
      });
      onOpenChange(false);

      setTimeout(() => {
        refetchConversation();
      }, 500);
    } catch (error) {
      toast({
        title: "Failed to create GitHub issue",
        description: error instanceof Error ? error.message : "An unknown error occurred",
        variant: "destructive",
      });
    } finally {
      setIsCreating(false);
    }
  };

  const handleLinkIssue = async () => {
    if (!selectedIssueNumber) {
      toast({
        title: "No issue selected",
        description: "Please select an issue to link",
        variant: "destructive",
      });
      return;
    }

    setIsLinking(true);
    try {
      const result = await linkIssue({
        mailboxSlug,
        conversationSlug,
        issueNumber: selectedIssueNumber,
      });

      toast({
        title: "GitHub issue linked",
        description: (
          <a href={result.issueUrl} target="_blank" rel="noopener noreferrer" className="underline">
            View issue #{result.issueNumber}
          </a>
        ),
        variant: "success",
      });
      onOpenChange(false);

      setTimeout(() => {
        refetchConversation();
      }, 500);
    } catch (error) {
      toast({
        title: "Failed to link GitHub issue",
        description: error instanceof Error ? error.message : "An unknown error occurred",
        variant: "destructive",
      });
    } finally {
      setIsLinking(false);
    }
  };

  const handleUpdateIssueState = async (newState: "open" | "closed") => {
    setIsUpdatingState(true);
    try {
      await updateIssueState({
        mailboxSlug,
        conversationSlug,
        state: newState,
      });

      toast({
        title: `GitHub issue ${newState === "open" ? "reopened" : "closed"}`,
        description: `Issue #${issueNumber} has been ${newState === "open" ? "reopened" : "closed"}.`,
        variant: "success",
      });

      if (newState === "closed") {
        onOpenChange(false);
      }

      setTimeout(() => {
        refetchConversation();
      }, 500);
    } catch (error) {
      toast({
        title: `Failed to ${newState === "open" ? "reopen" : "close"} GitHub issue`,
        description: error instanceof Error ? error.message : "An unknown error occurred",
        variant: "destructive",
      });
    } finally {
      setIsUpdatingState(false);
    }
  };

  // Only show if GitHub is connected and a repo is configured
  if (!mailbox?.githubConnected || !mailbox.githubRepoOwner || !mailbox.githubRepoName) {
    return (
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>GitHub Repository Not Configured</DialogTitle>
          <DialogDescription>
            Please configure a GitHub repository in the mailbox settings to use this feature.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button onClick={() => onOpenChange(false)}>Close</Button>
        </DialogFooter>
      </DialogContent>
    );
  }

  return (
    <DialogContent className="sm:max-w-[600px]">
      <DialogHeader>
        <DialogTitle>GitHub Issue</DialogTitle>
        <DialogDescription>Manage GitHub issues for this conversation.</DialogDescription>
      </DialogHeader>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className={`grid w-full ${hasLinkedIssue ? "grid-cols-3" : "grid-cols-2"}`}>
          {hasLinkedIssue && <TabsTrigger value="view">View Linked Issue</TabsTrigger>}
          <TabsTrigger value="create">Create New Issue</TabsTrigger>
          <TabsTrigger value="link">Link Existing Issue</TabsTrigger>
        </TabsList>

        {hasLinkedIssue && (
          <TabsContent value="view" className="space-y-4 mt-4">
            <div className="p-4 border rounded-md">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-medium">
                  Issue #{issueNumber} - {isIssueClosed ? "Closed" : "Open"}
                </h3>
                <a
                  href={issueUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center text-sm text-blue-500 hover:underline"
                >
                  View on GitHub <ExternalLinkIcon className="h-3 w-3 ml-1" />
                </a>
              </div>
              <div className="space-y-2">
                {isIssueClosed ? (
                  <Button onClick={() => handleUpdateIssueState("open")} disabled={isUpdatingState} className="w-full">
                    {isUpdatingState ? <LoadingSpinner size="sm" /> : "Reopen Issue"}
                  </Button>
                ) : (
                  <Button
                    onClick={() => handleUpdateIssueState("closed")}
                    disabled={isUpdatingState}
                    className="w-full"
                  >
                    {isUpdatingState ? <LoadingSpinner size="sm" /> : "Close Issue"}
                  </Button>
                )}
              </div>
            </div>
          </TabsContent>
        )}

        <TabsContent value="create" className="space-y-4 mt-4">
          <div className="space-y-2">
            <Label htmlFor="title">Title</Label>
            <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="body">Description</Label>
            <Textarea
              id="body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={10}
              className="resize-none"
            />
          </div>
          <DialogFooter>
            <Button onClick={handleCreateIssue} disabled={isCreating}>
              {isCreating ? <LoadingSpinner size="sm" /> : "Create Issue"}
            </Button>
          </DialogFooter>
        </TabsContent>

        <TabsContent value="link" className="space-y-4 mt-4">
          {isLoadingIssues ? (
            <div className="flex justify-center py-4">
              <LoadingSpinner />
            </div>
          ) : issues && issues.length > 0 ? (
            <div className="space-y-2">
              <Label htmlFor="issue">Select an issue</Label>
              <Select
                value={selectedIssueNumber?.toString()}
                onValueChange={(value) => setSelectedIssueNumber(Number(value))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select an issue" />
                </SelectTrigger>
                <SelectContent>
                  {issues.map((issue: GitHubIssue) => (
                    <SelectItem key={issue.number} value={issue.number.toString()}>
                      #{issue.number} - {issue.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : (
            <div className="text-center py-4 text-muted-foreground">No open issues found in the repository.</div>
          )}
          <DialogFooter>
            <Button onClick={handleLinkIssue} disabled={isLinking || !selectedIssueNumber}>
              {isLinking ? <LoadingSpinner size="sm" /> : "Link Issue"}
            </Button>
          </DialogFooter>
        </TabsContent>
      </Tabs>
    </DialogContent>
  );
};
