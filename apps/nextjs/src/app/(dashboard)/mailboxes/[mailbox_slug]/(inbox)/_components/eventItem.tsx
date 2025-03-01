import {
  ArrowUturnLeftIcon,
  ArrowUturnUpIcon,
  ExclamationCircleIcon,
  FlagIcon,
  UserIcon,
} from "@heroicons/react/24/outline";
import { upperFirst } from "lodash";
import { ConversationEvent } from "@/app/types/global";
import HumanizedTime from "@/components/humanizedTime";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

const statusVerbs = {
  open: "opened",
  closed: "closed",
  escalated: "escalated",
  spam: "marked as spam",
};

const statusIcons = {
  open: ArrowUturnUpIcon,
  closed: ArrowUturnLeftIcon,
  escalated: FlagIcon,
  spam: ExclamationCircleIcon,
};

export const EventItem = ({ event }: { event: ConversationEvent }) => {
  if (!event.changes) return null;

  const description = [
    event.changes.status ? statusVerbs[event.changes.status] : null,
    event.changes.assignedToUser !== undefined
      ? event.changes.assignedToUser
        ? `assigned to ${event.changes.assignedToUser}`
        : "unassigned"
      : null,
  ]
    .filter(Boolean)
    .join(" and ");

  const hasDetails = event.byUser || event.reason;
  const Icon = event.changes.status ? statusIcons[event.changes.status] : UserIcon;

  return (
    <div className="flex items-center justify-center gap-1 text-sm text-muted-foreground">
      <Icon className="h-4 w-4" />
      <span>{upperFirst(description)}</span>
      {hasDetails && (
        <>
          <span>·</span>
          <Tooltip>
            <TooltipTrigger asChild>
              <button className="cursor-help decoration-dotted underline">Details</button>
            </TooltipTrigger>
            <TooltipContent className="bg-background text-foreground" sideOffset={5}>
              <div className="flex flex-col gap-1">
                {event.byUser && (
                  <div>
                    <strong>By:</strong> {event.byUser}
                  </div>
                )}
                {event.reason && (
                  <div>
                    <strong>Reason:</strong> {event.reason}
                  </div>
                )}
              </div>
            </TooltipContent>
          </Tooltip>
        </>
      )}
      <span>·</span>
      <span>
        <HumanizedTime time={event.createdAt} />
      </span>
    </div>
  );
};

export default EventItem;
