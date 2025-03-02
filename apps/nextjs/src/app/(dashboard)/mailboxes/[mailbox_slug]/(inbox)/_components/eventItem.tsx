import {
  ArrowUturnLeftIcon,
  ArrowUturnUpIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  ExclamationCircleIcon,
  FlagIcon,
  UserIcon,
} from "@heroicons/react/24/outline";
import { upperFirst } from "lodash";
import { useState } from "react";
import { ConversationEvent } from "@/app/types/global";
import HumanizedTime from "@/components/humanizedTime";

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
  const [detailsExpanded, setDetailsExpanded] = useState(false);
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
    <div className="flex flex-col mx-auto">
      <button
        className="flex items-center justify-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        onClick={() => setDetailsExpanded(!detailsExpanded)}
      >
        {hasDetails &&
          (detailsExpanded ? <ChevronDownIcon className="h-3 w-3" /> : <ChevronRightIcon className="h-3 w-3" />)}
        <Icon className="h-4 w-4" />
        <span className="flex items-center gap-1">{upperFirst(description)}</span>
        <span>·</span>
        <span>
          <HumanizedTime time={event.createdAt} />
        </span>
      </button>

      {hasDetails && detailsExpanded && (
        <div className="mt-2 text-sm text-muted-foreground border rounded p-4">
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
        </div>
      )}
    </div>
  );
};

export default EventItem;
