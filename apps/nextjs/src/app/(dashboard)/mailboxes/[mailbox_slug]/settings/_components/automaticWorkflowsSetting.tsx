"use client";

import { PlusCircleIcon, QuestionMarkCircleIcon, TrashIcon } from "@heroicons/react/24/outline";
import cx from "classnames";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import SectionWrapper from "@/app/(dashboard)/mailboxes/[mailbox_slug]/settings/_components/sectionWrapper";
import {
  AutomaticWorkflowItems,
  ReorderingHandle,
  SortableList,
} from "@/app/(dashboard)/mailboxes/[mailbox_slug]/settings/_components/sortableList";
import { AssigneeOption, AssignSelect } from "@/components/assignSelect";
import { toast } from "@/components/hooks/use-toast";
import LoadingSpinner from "@/components/loadingSpinner";
import TipTapEditor from "@/components/tiptap/editor";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { useDebouncedCallback } from "@/components/useDebouncedCallback";
import { api } from "@/trpc/react";
import { WorkflowAction, WorkflowActionInfo } from "@/types/workflows";

export type Workflow = {
  id: number;
  name: string;
  prompt: string;
  order: number;
  runOnReplies: boolean;
  autoReplyFromMetadata: boolean;
} & WorkflowActionInfo;

export const ACTION_TO_HUMANIZED_MAP: Record<WorkflowAction, string> = {
  close_ticket: "Close ticket",
  mark_spam: "Mark as spam",
  reply_and_close_ticket: "Reply and close ticket",
  reply_and_set_open: "Reply and open ticket",
  assign_user: "Assign user",
  unknown: "(Deprecated workflow action)",
};

const ACTIONS_WITH_MESSAGE: WorkflowAction[] = ["reply_and_close_ticket", "reply_and_set_open"];

const ACTIONS_WITH_AUTO_REPLY: WorkflowAction[] = ["reply_and_close_ticket"];

const WorkflowEditForm = ({
  mailboxSlug,
  workflow,
  onSubmit,
  conversationSlug,
  onCancel,
}: {
  mailboxSlug: string;
  workflow: EditableWorkflow;
  onSubmit: (params: { workflow: EditableWorkflow; matchingConversations: MatchingConversation[] }) => Promise<void>;
  conversationSlug?: string;
  onCancel?: () => void;
}) => {
  const { data: mailbox } = api.mailbox.get.useQuery({ mailboxSlug });
  const [selectedWorkflow, setSelectedWorkflow] = useState(workflow);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const showReplyEditor =
    selectedWorkflow.action &&
    ACTIONS_WITH_MESSAGE.includes(selectedWorkflow.action) &&
    (ACTIONS_WITH_AUTO_REPLY.includes(selectedWorkflow.action) ? !selectedWorkflow.autoReplyFromMetadata : true);
  const messageMemoized = useMemo(() => ({ content: selectedWorkflow.message ?? "" }), [selectedWorkflow.action]);

  const apiUtils = api.useUtils();
  const matchingConversationsInput = {
    mailboxSlug,
    conversationSlug: conversationSlug ?? "",
    prompt: selectedWorkflow.prompt,
  };
  const matchingConversations = api.mailbox.workflows.listMatchingConversations.useQuery(matchingConversationsInput, {
    enabled: false,
  });

  const fetchMatchingConversations = async () => {
    if (!conversationSlug) return;

    try {
      await apiUtils.mailbox.workflows.listMatchingConversations.cancel();
      if (!selectedWorkflow.prompt?.trim()) {
        apiUtils.mailbox.workflows.listMatchingConversations.setData(matchingConversationsInput, { conversations: [] });
        return;
      }
      await matchingConversations.refetch();
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return;
      toast({
        variant: "destructive",
        title: "Error fetching conversation",
      });
    }
  };
  const debouncedFetchMatchingConversations = useDebouncedCallback(fetchMatchingConversations, 300);
  useEffect(() => {
    debouncedFetchMatchingConversations();
  }, [selectedWorkflow.prompt]);

  const onSubmitWorkflow = async () => {
    setIsSubmitting(true);

    const validateWorkflow = () => {
      const updatedWorkflow: EditableWorkflow = { ...selectedWorkflow };

      if (!updatedWorkflow.action) {
        toast({
          variant: "destructive",
          title: "Please select a workflow action",
        });
        return false;
      }

      if (!ACTIONS_WITH_AUTO_REPLY.includes(updatedWorkflow.action)) updatedWorkflow.autoReplyFromMetadata = false;

      const isStaticMessageAction =
        ACTIONS_WITH_MESSAGE.includes(updatedWorkflow.action) && !updatedWorkflow.autoReplyFromMetadata;
      if (!isStaticMessageAction) updatedWorkflow.message = undefined;

      if (!updatedWorkflow.prompt?.trim()) {
        toast({
          variant: "destructive",
          title: "The prompt field cannot be empty",
        });
        return false;
      } else if (isStaticMessageAction && !updatedWorkflow.message?.trim()) {
        toast({
          variant: "destructive",
          title: "The message field cannot be empty",
        });
        return false;
      } else if (updatedWorkflow.action === "assign_user" && !updatedWorkflow.assignedUserId) {
        toast({
          variant: "destructive",
          title: "Please select a user to assign",
        });
        return false;
      }

      return updatedWorkflow;
    };
    const updatedWorkflow = validateWorkflow();
    if (updatedWorkflow) {
      await onSubmit({
        workflow: updatedWorkflow,
        matchingConversations: matchingConversations.data?.conversations ?? [],
      });
    }
    setIsSubmitting(false);
  };

  if (!mailbox) return null;

  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        await onSubmitWorkflow();
      }}
      className="border rounded-lg p-4"
    >
      <div className="grid gap-4">
        {selectedWorkflow.id && (
          <div className="grid gap-1">
            <Label htmlFor="name">Workflow name</Label>
            <Input
              name="name"
              defaultValue={selectedWorkflow.name || ""}
              autoFocus
              placeholder={"e.g., The site is down - we're working on it"}
              onChange={(e) =>
                setSelectedWorkflow((workflow) => ({
                  ...workflow,
                  name: e.target.value,
                }))
              }
            />
          </div>
        )}
        <div className="grid gap-1">
          <Label htmlFor="prompt">If</Label>
          <Textarea
            name="prompt"
            placeholder='e.g., The subject line contains the words "site is down" and the email ends with "gmail.com"'
            defaultValue={selectedWorkflow.prompt}
            rows={4}
            required
            onChange={(e) =>
              setSelectedWorkflow((workflow) => ({
                ...workflow,
                prompt: e.target.value,
              }))
            }
          />
          <p className="text-xs text-muted-foreground">{"Specify which tickets should trigger this workflow"}</p>
        </div>
        <div className="grid gap-1">
          <Label htmlFor="action">Then</Label>
          <Select
            name="action"
            value={selectedWorkflow.action ?? "close_ticket"}
            onValueChange={(action) =>
              setSelectedWorkflow((workflow) => ({ ...workflow, action: action as WorkflowAction }))
            }
          >
            <SelectTrigger className="px-3 py-2">
              <SelectValue placeholder="Select an action" />
            </SelectTrigger>
            <SelectContent>
              {[
                {
                  value: "close_ticket",
                  label: ACTION_TO_HUMANIZED_MAP.close_ticket,
                },
                {
                  value: "mark_spam",
                  label: ACTION_TO_HUMANIZED_MAP.mark_spam,
                },
                {
                  value: "reply_and_close_ticket",
                  label: ACTION_TO_HUMANIZED_MAP.reply_and_close_ticket,
                },
                {
                  value: "reply_and_set_open",
                  label: ACTION_TO_HUMANIZED_MAP.reply_and_set_open,
                },
                {
                  value: "assign_user",
                  label: ACTION_TO_HUMANIZED_MAP.assign_user,
                },
              ].map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">{"Specify what this workflow should do when triggered"}</p>
        </div>
        {selectedWorkflow.action && ACTIONS_WITH_MESSAGE.includes(selectedWorkflow.action) ? (
          <div className={showReplyEditor ? "grid gap-2" : ""}>
            {showReplyEditor ? (
              <div className="relative grid gap-1">
                <Label htmlFor="message">Message</Label>
                <div className="min-h-[10rem]">
                  <TipTapEditor
                    ariaLabel="Message"
                    autoFocus
                    defaultContent={messageMemoized}
                    onModEnter={() => {
                      if (!isSubmitting) onSubmitWorkflow();
                    }}
                    onUpdate={(message, isEmpty) =>
                      setSelectedWorkflow((workflow) => ({
                        ...workflow,
                        message: isEmpty ? "" : message,
                      }))
                    }
                    placeholder="Enter a reply for this workflow..."
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  {"Your message will be sent to tickets that trigger this workflow"}
                </p>
              </div>
            ) : null}

            {mailbox.hasMetadataEndpoint && ACTIONS_WITH_AUTO_REPLY.includes(selectedWorkflow.action) ? (
              <div className="flex items-center gap-2">
                <Switch
                  aria-label="Reply with AI instead"
                  checked={selectedWorkflow.autoReplyFromMetadata}
                  onCheckedChange={(checked) =>
                    setSelectedWorkflow((workflow) => ({
                      ...workflow,
                      autoReplyFromMetadata: checked,
                    }))
                  }
                />
                <Label className="flex items-center">
                  Reply with AI instead
                  <AIReplyExplanation />
                </Label>
              </div>
            ) : null}
          </div>
        ) : null}
        {selectedWorkflow.action === "assign_user" ? (
          <div className="grid gap-1">
            <Label htmlFor="assignee">Assign to</Label>
            <AssignSelect
              selectedUserId={selectedWorkflow.assignedUserId}
              onChange={(assignee: AssigneeOption | null) => {
                setSelectedWorkflow((workflow) => ({
                  ...workflow,
                  assignedUserId: assignee?.id || undefined,
                }));
              }}
            />
          </div>
        ) : null}
        <div className="mt-1 flex items-center gap-2">
          <Switch
            checked={selectedWorkflow?.runOnReplies ?? false}
            onCheckedChange={(checked) =>
              setSelectedWorkflow((workflow) => {
                if (workflow) {
                  return { ...workflow, runOnReplies: checked };
                }
                return workflow;
              })
            }
          />
          <Label className="cursor-pointer">Re-run this workflow for customer follow-ups</Label>
        </div>
        {conversationSlug ? (
          <div className="grid gap-1">
            <Label>Tickets</Label>
            <MatchingConversations
              busy={matchingConversations.isLoading}
              conversations={matchingConversations.data?.conversations ?? []}
            />
          </div>
        ) : null}
      </div>
      <div className="mt-4 flex justify-end gap-2">
        {onCancel && (
          <Button type="button" variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
        )}
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Saving…" : "Save"}
        </Button>
      </div>
    </form>
  );
};

const WorkflowItem = ({
  workflow,
  onDelete,
  onSubmit,
  mailboxSlug,
  conversationSlug,
}: {
  onDelete: () => void;
  onSubmit: (params: { workflow: EditableWorkflow; matchingConversations: MatchingConversation[] }) => Promise<void>;
  workflow: Workflow;
  mailboxSlug: string;
  conversationSlug?: string;
}) => {
  const [isEditing, setIsEditing] = useState(false);

  return (
    <div className="mb-2">
      <div className="flex justify-between gap-1" aria-label="Workflow item">
        <ReorderingHandle className="self-start mt-2" />
        {isEditing ? (
          <div className="flex-1">
            <WorkflowEditForm
              workflow={workflow}
              mailboxSlug={mailboxSlug}
              conversationSlug={conversationSlug}
              onSubmit={async (params) => {
                await onSubmit(params);
                setIsEditing(false);
              }}
              onCancel={() => setIsEditing(false)}
            />
          </div>
        ) : (
          <>
            <button
              className="w-full truncate text-left text-sm hover:underline"
              onClick={(e) => {
                e.preventDefault();
                setIsEditing(!isEditing);
              }}
            >
              {workflow.name || <span className="text-muted-foreground">(no name)</span>}
            </button>
            <div className="flex items-center gap-1">
              <Badge>
                <span className="max-w-[30ch] truncate">{ACTION_TO_HUMANIZED_MAP[workflow.action]}</span>
              </Badge>
              <Button
                variant="ghost"
                size="sm"
                iconOnly
                onClick={(e) => {
                  e.preventDefault();
                  onDelete();
                }}
              >
                <TrashIcon className="h-4 w-4" />
                <span className="sr-only">Delete</span>
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

type WorkflowActionOption = { value: WorkflowAction; label: string };
export type MatchingConversation = {
  subject: string;
  slug: string;
  email_from: string | null;
};

const MatchingConversations = ({ conversations, busy }: { conversations: MatchingConversation[]; busy: boolean }) => {
  const tdClassName = cx(
    busy
      ? 'relative after:content-[""] after:block after:bg-border after:h-[1em] after:w-20 after:animate-default-pulse after:rounded'
      : "",
  );

  return (
    <div className="flex flex-col gap-2">
      {conversations.length > 0 ? (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Subject</TableHead>
              <TableHead>Sender</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody className={cx(busy ? "pointer-events-none opacity-50" : "")}>
            {conversations.map((ticket, index) => (
              <TableRow key={index}>
                {busy ? (
                  <>
                    <TableCell className={tdClassName} />
                    <TableCell className={tdClassName} />
                  </>
                ) : (
                  <>
                    <TableCell>{ticket.subject}</TableCell>
                    <TableCell>{ticket.email_from}</TableCell>
                  </>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      ) : (
        <div className="flex items-center gap-2">
          {busy ? <LoadingSpinner size="sm" /> : null}
          <div className="text-sm text-muted-foreground">No matching open conversations</div>
        </div>
      )}
    </div>
  );
};

const AIReplyExplanation = () => {
  return (
    <div className="group relative">
      <QuestionMarkCircleIcon className="ml-0.5 h-4 w-4 text-foreground" />
      <div className="bg-primary absolute bottom-full left-1/2 z-10 mb-2 hidden w-80 -translate-x-1/2 transform rounded-md border border-border p-4 text-primary-foreground shadow-lg group-hover:block">
        <div className="mb-4 text-sm">
          Turn on <span className="text-secondary">Reply with AI</span> to send a personalized response generated by AI.
        </div>
        <div className="text-sm">
          This response is guided by user-specific data from the Metadata Endpoint entered in your{" "}
          <span className="text-secondary">Settings</span>.
        </div>
      </div>
    </div>
  );
};

export type EditableWorkflow = Omit<Workflow, "id" | "name"> & {
  id?: number;
  name?: string;
  assignedUserId?: string | undefined;
};

const WorkflowsSetting = ({
  mailboxSlug,
  workflows,
  handleDelete,
  conversationSlug,
}: {
  mailboxSlug: string;
  workflows: Workflow[];
  handleDelete: (id: number) => Promise<string | null>;
  conversationSlug?: string;
}) => {
  const router = useRouter();
  const { data: mailbox } = api.mailbox.get.useQuery({ mailboxSlug });
  const [showNewWorkflowForm, setShowNewWorkflowForm] = useState(false);
  const { mutateAsync: setWorkflowMutation } = api.mailbox.workflows.set.useMutation();
  const { mutateAsync: reorderWorkflowsMutation } = api.mailbox.workflows.reorder.useMutation();

  const submitWorkflow = async ({ workflow: updatedWorkflow }: { workflow: EditableWorkflow }) => {
    try {
      await setWorkflowMutation({ mailboxSlug, ...updatedWorkflow });
      router.refresh();
      toast({
        title: "Workflow saved!",
      });
      setShowNewWorkflowForm(false);
    } catch (e) {
      console.error(e);
      toast({
        variant: "destructive",
        title: "Error saving workflow",
      });
    }
  };

  const normalizeWorkflowOrder = (workflows: Workflow[]) => workflows.map((w, idx) => ({ ...w, order: idx + 1 }));
  const [workflowList, setWorkflowList] = useState(() => normalizeWorkflowOrder(workflows));
  useEffect(() => setWorkflowList(normalizeWorkflowOrder(workflows)), [workflows]);
  const onReorder = async (newIdOrder: number[]) => {
    const newList = workflows
      .sort((a, b) => newIdOrder.indexOf(a.id) - newIdOrder.indexOf(b.id))
      .map((wf, idx) => ({ ...wf, order: idx }));
    setWorkflowList(newList);
    if (newList.some((wf, i) => workflowList[i]?.id !== wf.id)) {
      try {
        await reorderWorkflowsMutation({
          mailboxSlug,
          positions: newIdOrder,
        });
        router.refresh();
        toast({
          title: "Workflows reordered!",
        });
      } catch (e) {
        console.error(e);
        toast({
          variant: "destructive",
          title: "Failed to reorder workflows",
        });
      }
    }
  };

  return (
    <>
      <SectionWrapper title="Automatic Workflows" description="Tell Helper how to handle specific types of emails">
        <SortableList
          currentOrder={workflowList.map((w) => w.id)}
          onReorder={onReorder}
          tag={workflowList.length ? AutomaticWorkflowItems : undefined}
        >
          {workflowList.map((workflow) => (
            <WorkflowItem
              key={workflow.id}
              workflow={workflow}
              onDelete={() => handleDelete(workflow.id)}
              onSubmit={submitWorkflow}
              mailboxSlug={mailboxSlug}
              conversationSlug={conversationSlug}
            />
          ))}
        </SortableList>
        {showNewWorkflowForm ? (
          <div className="mb-4">
            <WorkflowEditForm
              workflow={{
                prompt: "",
                action: "reply_and_close_ticket",
                message: "",
                runOnReplies: false,
                autoReplyFromMetadata: mailbox?.hasMetadataEndpoint ?? false,
                order: workflows.length ? workflows.reduce((maxOrder, obj) => Math.max(maxOrder, obj.order), 0) + 1 : 1,
              }}
              mailboxSlug={mailboxSlug}
              conversationSlug={conversationSlug}
              onSubmit={submitWorkflow}
              onCancel={() => setShowNewWorkflowForm(false)}
            />
          </div>
        ) : (
          <Button
            variant="subtle"
            onClick={(e) => {
              e.preventDefault();
              setShowNewWorkflowForm(true);
            }}
          >
            <PlusCircleIcon className="mr-2 h-4 w-4" />
            Add workflow
          </Button>
        )}
      </SectionWrapper>
    </>
  );
};

export default WorkflowsSetting;
