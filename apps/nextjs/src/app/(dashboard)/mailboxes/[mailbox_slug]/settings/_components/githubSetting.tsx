import * as Sentry from "@sentry/nextjs";
import { useRouter } from "next/navigation";
import { useEffect, useId, useState } from "react";
import GitHubSvg from "@/app/(dashboard)/mailboxes/[mailbox_slug]/_components/icons/github.svg";
import SectionWrapper from "@/app/(dashboard)/mailboxes/[mailbox_slug]/settings/_components/sectionWrapper";
import { toast } from "@/components/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useRunOnce } from "@/components/useRunOnce";
import { RouterOutputs } from "@/trpc";
import { api } from "@/trpc/react";

export type GitHubUpdates = {
  repoOwner?: string | null;
  repoName?: string | null;
};

export const GitHubRepositories = ({
  id,
  selectedRepoFullName,
  mailbox,
  onChange,
}: {
  id: string;
  selectedRepoFullName?: string;
  mailbox: RouterOutputs["mailbox"]["get"];
  onChange: (changes: GitHubUpdates) => void;
}) => {
  const utils = api.useUtils();
  const [repositories, setRepositories] = useState<{ id: number; name: string; fullName: string; owner: string }[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useRunOnce(() => {
    const fetchRepositories = async () => {
      try {
        setIsLoading(true);
        setRepositories(
          await utils.client.mailbox.github.repositories.query({
            mailboxSlug: mailbox.slug,
          }),
        );
      } catch (e) {
        Sentry.captureException(e);
        toast({
          title: "Error fetching available repositories",
          variant: "destructive",
        });
      } finally {
        setIsLoading(false);
      }
    };

    if (mailbox.githubConnected) {
      fetchRepositories();
    } else {
      setIsLoading(false);
    }
  });

  const handleRepoChange = (fullName: string) => {
    const [repoOwner, repoName] = fullName.split("/");
    onChange({ repoOwner, repoName });
  };

  return (
    <Select disabled={isLoading || !repositories.length} value={selectedRepoFullName} onValueChange={handleRepoChange}>
      <SelectTrigger id={id} className="w-full">
        <SelectValue placeholder={isLoading ? "Loading repositories..." : "Select a repository"} />
      </SelectTrigger>
      <SelectContent>
        {repositories.map((repo) => (
          <SelectItem key={repo.id} value={repo.fullName}>
            {repo.fullName}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
};

const GitHubSetting = ({
  mailbox,
  onChange,
}: {
  mailbox: RouterOutputs["mailbox"]["get"];
  onChange: (changes?: GitHubUpdates) => void;
}) => {
  const router = useRouter();
  const { mutateAsync: disconnectGitHub } = api.mailbox.github.disconnect.useMutation();
  const [isGitHubConnected, setGitHubConnected] = useState(mailbox.githubConnected);
  const repoUID = useId();

  // Check for GitHub connection status from URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const githubConnectResult = params.get("githubConnectResult");

    if (githubConnectResult === "success") {
      toast({
        title: "GitHub connected successfully",
        variant: "success",
      });
      // Use Next.js router to update the URL
      router.push(`${window.location.pathname}?tab=integrations`);
    } else if (githubConnectResult === "error") {
      toast({
        title: "Failed to connect GitHub",
        variant: "destructive",
      });
    }
  }, [router]);

  const onDisconnectGitHub = async () => {
    try {
      await disconnectGitHub({ mailboxSlug: mailbox.slug });
      setGitHubConnected(false);
      toast({
        title: "GitHub disconnected successfully",
        variant: "success",
      });
    } catch (e) {
      toast({
        title: "Error disconnecting GitHub",
        variant: "destructive",
      });
    }
  };

  const selectedRepoFullName =
    mailbox.githubRepoOwner && mailbox.githubRepoName
      ? `${mailbox.githubRepoOwner}/${mailbox.githubRepoName}`
      : undefined;

  return (
    <SectionWrapper title="GitHub Integration" description="Create and track GitHub issues from conversations.">
      {isGitHubConnected ? (
        <>
          <div className="grid gap-1">
            <Label htmlFor={repoUID}>Repository</Label>
            <GitHubRepositories
              id={repoUID}
              selectedRepoFullName={selectedRepoFullName}
              mailbox={mailbox}
              onChange={onChange}
            />
            <p className="mt-1 text-sm text-muted-foreground">
              Select a single repository where issues will be created. Only one repository can be linked per mailbox.
              {selectedRepoFullName && (
                <>
                  <br />
                  <span className="font-medium">Important:</span> Make sure issues are enabled in your repository
                  settings. <br />
                  (scroll down to the "Features" section to see issues box)
                </>
              )}
            </p>
            {selectedRepoFullName && (
              <div className="mt-2">
                <a
                  href={`https://github.com/${selectedRepoFullName}/settings`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-primary hover:underline"
                >
                  Check repository settings →
                </a>
              </div>
            )}
          </div>
          <div className="mt-4">
            <Button
              variant="destructive_outlined"
              onClick={() => {
                if (
                  confirm(
                    "Are you sure you want to disconnect GitHub? This will remove the repository link and disable GitHub issue creation.",
                  )
                ) {
                  onDisconnectGitHub();
                }
              }}
            >
              Disconnect from GitHub
            </Button>
          </div>
        </>
      ) : (
        <Button onClick={() => router.push(mailbox.githubConnectUrl)} variant="subtle">
          <GitHubSvg className="mr-2 h-4 w-4" />
          Connect to GitHub
        </Button>
      )}
    </SectionWrapper>
  );
};

export default GitHubSetting;
