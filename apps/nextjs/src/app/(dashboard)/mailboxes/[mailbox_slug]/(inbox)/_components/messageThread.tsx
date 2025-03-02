import { ChatBubbleLeftRightIcon, InformationCircleIcon, QuestionMarkCircleIcon } from "@heroicons/react/24/outline";
import { EventItem } from "@/app/(dashboard)/mailboxes/[mailbox_slug]/(inbox)/_components/eventItem";
import MessageItem from "@/app/(dashboard)/mailboxes/[mailbox_slug]/(inbox)/_components/messageItem";
import type { Message } from "@/app/types/global";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ToolMetadata } from "@/db/schema";
import { WorkflowAction } from "@/types/workflows";
import { ConversationWithNewMessages } from "./conversation";
import { ToolItem } from "./toolItem";

export const MessageThread = ({
  conversation,
  onPreviewAttachment,
  onViewWorkflowRun,
  onDoubleClickWhiteSpace,
  mailboxSlug,
}: {
  conversation: ConversationWithNewMessages;
  onPreviewAttachment: (message: Message, index: number) => void;
  onViewWorkflowRun: (message: Message) => void;
  onDoubleClickWhiteSpace: (e: React.MouseEvent<HTMLDivElement>) => void;
  mailboxSlug: string;
}) => {
  const lastEmail = conversation.messages.filter((message) => message.type === "message").at(-1);

  const handleDoubleClickWhitespace = (e: React.MouseEvent<HTMLDivElement>) => {
    const isTextArea =
      e.target instanceof Node &&
      (e.target.nodeType === Node.TEXT_NODE ||
        (e.target instanceof Element &&
          ["P", "SPAN", "A", "STRONG", "EM", "U", "LI", "UL", "OL"].includes(e.target.tagName)));
    if (!isTextArea) {
      onDoubleClickWhiteSpace(e);
    }
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-1 flex-col gap-8 pb-4" onDoubleClick={handleDoubleClickWhitespace}>
        {conversation.source == "chat#prompt" && (
          <div className="flex items-center justify-center gap-1 text-sm text-muted-foreground">
            <QuestionMarkCircleIcon className="h-4 w-4 text-muted-foreground" />
            <span>Started this conversation from a prompt</span>
          </div>
        )}
        {conversation.messages.map((message, index) =>
          message.type === "event" ? (
            <EventItem key={message.id} event={message} />
          ) : message.role === "tool" && message.type === "message" ? (
            <ToolItem
              key={message.id}
              message={{ ...message, metadata: message.metadata as ToolMetadata }}
              initialExpanded={index === conversation.messages.length - 1}
            />
          ) : (
            <MessageItem
              key={`${message.type}-${message.id}`}
              message={message}
              mailboxSlug={mailboxSlug}
              conversation={conversation}
              onPreviewAttachment={
                message.type === "message" && message.files.length
                  ? (index) => onPreviewAttachment(message, index)
                  : undefined
              }
              onViewWorkflowRun={
                message.type === "message" && message.workflowRun ? () => onViewWorkflowRun(message) : undefined
              }
            />
          ),
        )}
        {conversation.summary && conversation.summary.length > 0 && (
          <div className="mx-auto flex max-w-2xl flex-col gap-2">
            <div className="flex items-center gap-1 text-base text-muted-foreground">
              <ChatBubbleLeftRightIcon className="h-4 w-4 shrink-0" />
              Conversation summary
            </div>
            <div className="flex flex-col">
              {conversation.summary.map((point, index) => (
                <div key={index} className="flex gap-3 text-base relative">
                  <div className="flex h-full flex-col items-center">
                    <div className={`absolute top-0 h-3 w-px bg-border ${index === 0 ? "opacity-0" : ""}`}></div>
                    <div className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-border"></div>
                    <div
                      className={`absolute top-4 bottom-0 w-px bg-border ${conversation.summary && index === conversation.summary.length - 1 ? "opacity-0" : ""}`}
                    ></div>
                  </div>
                  <div className="pb-4">{point}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
      {lastEmail && <NoReplyDraftedDisclaimer message={lastEmail} />}
    </div>
  );
};

const NoReplyDraftedDisclaimer = ({ message }: { message: Message }) => {
  if (!message.workflowRun || message.draft) return null;
  const disclaimers: Partial<Record<WorkflowAction, string>> = {
    close_ticket: "closes the ticket without replying to it",
    mark_spam: "marks the ticket as spam without replying to it",
  };
  const actionDescription = disclaimers[message.workflowRun.action];
  if (!actionDescription) return null;

  return (
    <Alert variant="default">
      <InformationCircleIcon className="h-4 w-4" />
      <AlertTitle>No reply drafted</AlertTitle>
      <AlertDescription>
        A reply was not drafted for this conversation because the{" "}
        <b>{message.workflowRun.name ?? "(no name)"} workflow</b> was triggered, which {actionDescription}.
      </AlertDescription>
    </Alert>
  );
};
