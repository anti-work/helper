"use client";

import { DocumentDuplicateIcon, EyeIcon, EyeSlashIcon, PlusCircleIcon } from "@heroicons/react/24/outline";
import cx from "classnames";
import { useParams, useRouter } from "next/navigation";
import { useRef, useState } from "react";
import CopyToClipboard from "react-copy-to-clipboard";
import SectionWrapper from "@/app/(dashboard)/mailboxes/[mailbox_slug]/settings/_components/sectionWrapper";
import type { MetadataEndpoint } from "@/app/types/global";
import { toast } from "@/components/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { api } from "@/trpc/react";

type MetadataEndpointSettingProps = {
  metadataEndpoint: MetadataEndpoint | null;
};

const MetadataEndpointSetting = ({ metadataEndpoint }: MetadataEndpointSettingProps) => {
  const params = useParams();
  const router = useRouter();
  const mailboxSlug = params.mailbox_slug as string;

  const inputRef = useRef<HTMLInputElement>(null);
  const [newUrl, setNewUrl] = useState(metadataEndpoint?.url || "");
  const [showSecret, setShowSecret] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [copyTooltip, setCopyTooltip] = useState({
    open: false,
    content: "",
  });

  const { mutateAsync: createEndpointMutation } = api.mailbox.metadataEndpoint.create.useMutation();
  const { mutateAsync: deleteEndpointMutation } = api.mailbox.metadataEndpoint.delete.useMutation();
  const { refetch: testEndpointQuery } = api.mailbox.metadataEndpoint.test.useQuery(
    { mailboxSlug },
    { enabled: false },
  );

  const testRequestTexts = {
    idle: "Send test request to URL",
    loading: "Sending test request...",
    success: "Sent!",
    error: "Test request failed",
  };
  const [testRequestStatus, setTestRequestStatus] = useState<keyof typeof testRequestTexts>("idle");

  const addEndpoint = async () => {
    if (inputRef.current && !inputRef.current.checkValidity()) {
      inputRef.current.reportValidity();
      return;
    }
    if (!newUrl) return;

    setIsLoading(true);
    try {
      const result = await createEndpointMutation({ mailboxSlug, url: newUrl });
      if (result?.error) {
        toast({
          variant: "destructive",
          title: result.error,
        });
        return;
      }
      router.refresh();
      toast({
        title: "Metadata endpoint added!",
      });
    } catch (e) {
      toast({
        variant: "destructive",
        title: "Error adding metadata endpoint",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const removeEndpoint = async () => {
    if (confirm("Are you sure you want to remove this Metadata Endpoint?")) {
      setIsLoading(true);
      try {
        const result = await deleteEndpointMutation({ mailboxSlug });
        if (result?.error) {
          toast({
            variant: "destructive",
            title: result.error,
          });
          return;
        }
        setNewUrl("");
        setShowSecret(false);
        router.refresh();
        toast({
          title: "Metadata endpoint removed!",
        });
      } catch (e) {
        toast({
          variant: "destructive",
          title: "Error removing metadata endpoint",
        });
      } finally {
        setIsLoading(false);
      }
    }
  };

  const sendTestRequest = async () => {
    setTestRequestStatus("loading");
    try {
      const { data: result } = await testEndpointQuery();
      if (result?.error) {
        toast({
          variant: "destructive",
          title: result.error,
        });
        setTestRequestStatus("error");
        return;
      }
      toast({
        title: "Test request succeeded!",
      });
      setTestRequestStatus("success");
    } catch (e) {
      toast({
        variant: "destructive",
        title: "Error sending test request",
      });
      setTestRequestStatus("error");
    } finally {
      setTimeout(() => setTestRequestStatus("idle"), 3000);
    }
  };

  return (
    <SectionWrapper
      title="Metadata Endpoint"
      description={
        <>
          <span>
            Add an endpoint to fetch relevant metadata when an email is received. Helper will return a JSON response in
            this format:
          </span>
          <span className="block">{`{"success": true, "metadata": {"label": "value"}}`}</span>
        </>
      }
    >
      <div className="grid gap-3">
        <div className="grid gap-1">
          <Label>URL</Label>
          <Input
            ref={inputRef}
            placeholder="Enter endpoint URL"
            type="url"
            onChange={(e) => setNewUrl(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addEndpoint();
              }
            }}
            value={newUrl}
            disabled={!!metadataEndpoint?.url}
            hint={
              metadataEndpoint?.url ? (
                <button
                  className={cx(
                    testRequestStatus === "idle" && "underline",
                    testRequestStatus === "error"
                      ? "text-destructive-500"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                  onClick={sendTestRequest}
                  disabled={testRequestStatus !== "idle"}
                >
                  {testRequestTexts[testRequestStatus]}
                </button>
              ) : null
            }
          />
        </div>
        {metadataEndpoint?.url ? (
          <>
            <div className="grid gap-1">
              <Label>HMAC Secret</Label>
              <Input
                type={showSecret ? "text" : "password"}
                value={metadataEndpoint.hmacSecret}
                disabled
                iconsSuffix={
                  <>
                    <TooltipProvider delayDuration={0}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            className="flex items-center gap-1"
                            onClick={(e) => {
                              e.preventDefault();
                              setTimeout(() => {
                                setShowSecret(!showSecret);
                              }, 100);
                            }}
                          >
                            {showSecret ? (
                              <EyeSlashIcon className="h-4 w-4 text-muted-foreground" />
                            ) : (
                              <EyeIcon className="h-4 w-4 text-muted-foreground" />
                            )}
                          </button>
                        </TooltipTrigger>
                        <TooltipContent>{showSecret ? "Hide" : "Show"}</TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                    <CopyToClipboard
                      text={metadataEndpoint.hmacSecret}
                      onCopy={(_) => {
                        setCopyTooltip((copyTooltip) => ({ ...copyTooltip, content: "Copied!" }));
                        setTimeout(() => {
                          setCopyTooltip((copyTooltip) => ({ ...copyTooltip, content: "" }));
                        }, 1000);
                      }}
                    >
                      <span>
                        <TooltipProvider delayDuration={0}>
                          <Tooltip
                            open={copyTooltip.open || !!copyTooltip.content}
                            onOpenChange={(open) => setCopyTooltip({ ...copyTooltip, open })}
                          >
                            <TooltipTrigger asChild>
                              <button
                                className="text-primary flex cursor-pointer items-center gap-1"
                                onClick={(e) => e.preventDefault()}
                              >
                                <DocumentDuplicateIcon className="h-4 w-4 text-muted-foreground" />
                              </button>
                            </TooltipTrigger>
                            <TooltipContent>{copyTooltip.content || "Copy"}</TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </span>
                    </CopyToClipboard>
                  </>
                }
              />
            </div>
            <div>
              <Button
                variant="destructive_outlined"
                disabled={isLoading}
                onClick={(e) => {
                  e.preventDefault();
                  removeEndpoint();
                }}
              >
                Remove endpoint
              </Button>
            </div>
          </>
        ) : (
          <div>
            <Button
              disabled={!newUrl || isLoading}
              variant="subtle"
              onClick={(e) => {
                e.preventDefault();
                addEndpoint();
              }}
            >
              <PlusCircleIcon className="mr-2 h-4 w-4" />
              Add endpoint
            </Button>
          </div>
        )}
      </div>
    </SectionWrapper>
  );
};

export default MetadataEndpointSetting;
