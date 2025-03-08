import { BellIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const EVENT_OPTIONS = [
  {
    value: "request_human_support",
    label: "Escalated to a human",
  },
  {
    value: "resolved_by_ai",
    label: "Resolved by AI",
  },
] as const;

type EventType = (typeof EVENT_OPTIONS)[number]["value"];

interface EventFilterProps {
  selectedEvents: EventType[];
  onChange: (events: EventType[]) => void;
}

export function EventFilter({ selectedEvents, onChange }: EventFilterProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant={selectedEvents.length > 0 ? "bright" : "outlined_subtle"} className="whitespace-nowrap">
          <BellIcon className="h-4 w-4 mr-2" />
          {selectedEvents.length === 1
            ? EVENT_OPTIONS.find((event) => event.value === selectedEvents[0])?.label
            : selectedEvents.length > 0
              ? `${selectedEvents.length} events`
              : "Events"}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        {EVENT_OPTIONS.map((event) => (
          <DropdownMenuCheckboxItem
            key={event.value}
            checked={selectedEvents.includes(event.value)}
            onCheckedChange={(checked) => {
              onChange(checked ? [...selectedEvents, event.value] : selectedEvents.filter((e) => e !== event.value));
            }}
          >
            {event.label}
          </DropdownMenuCheckboxItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
