import { useUser } from "@clerk/nextjs";
import { useEffect, useState } from "react";
import { useConversationContext } from "@/app/(dashboard)/mailboxes/[mailbox_slug]/(inbox)/_components/conversationContext";
import { useAssignTicket } from "@/app/(dashboard)/mailboxes/[mailbox_slug]/(inbox)/_components/useAssignTicket";
import { Command, CommandInput } from "@/components/ui/command";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { api } from "@/trpc/react";
import { useAssigneesPage } from "./assigneesPage";
import { CommandList } from "./commandList";
import { GitHubIssuePage } from "./githubIssuePage";
import { useMainPage } from "./mainPage";
import { NotesPage } from "./notesPage";
import { usePreviousRepliesPage } from "./previousRepliesPage";
import { ToolForm } from "./toolForm";
import { useToolsPage } from "./toolsPage";

type TicketCommandBarProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onGenerateDraft: () => void;
  onInsertReply: (content: string) => void;
  showCc: boolean;
  onToggleCc: () => void;
};

export function TicketCommandBar({
  open,
  onOpenChange,
  onGenerateDraft,
  onInsertReply,
  showCc,
  onToggleCc,
}: TicketCommandBarProps) {
  const { conversationSlug, mailboxSlug } = useConversationContext();
  const [inputValue, setInputValue] = useState("");
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [page, setPage] = useState<"main" | "previous-replies" | "assignees" | "notes" | "tools" | "github-issue">(
    "main",
  );
  const { user: currentUser } = useUser();
  const { data: orgMembers } = api.organization.getMembers.useQuery(undefined, {
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });
  const { assignTicket } = useAssignTicket();

  const [isLoadingPreviousReplies, setIsLoadingPreviousReplies] = useState(false);
  const { data: previousReplies, refetch: refetchPreviousReplies } =
    api.mailbox.conversations.messages.previousReplies.useQuery(
      {
        mailboxSlug,
        conversationSlug,
      },
      {
        enabled: false,
        refetchOnMount: true,
      },
    );

  // Reset selection when dialog opens/closes or page changes
  useEffect(() => {
    setSelectedItemId(null);
    setInputValue("");

    if (page === "previous-replies") {
      setIsLoadingPreviousReplies(true);
      void refetchPreviousReplies().finally(() => {
        setIsLoadingPreviousReplies(false);
      });
    }

    if (!open) {
      // Wait for the close animation
      setTimeout(() => {
        setPage("main");
        toolsPage.clearSelectedTool();
      }, 500);
    }
  }, [open, page, refetchPreviousReplies]);

  const handleSelect = (itemId: string) => {
    const allItems = currentGroups.flatMap((group) => group.items).filter((item) => !item.hidden);
    const selectedItem = allItems.find((item) => item.id === itemId);

    if (selectedItem?.id === "previous-replies") {
      setPage("previous-replies");
      setSelectedItemId(null);
    } else if (selectedItem?.id === "assign") {
      setPage("assignees");
      setSelectedItemId(null);
    } else if (selectedItem?.id === "add-note") {
      setPage("notes");
      setSelectedItemId(null);
    } else if (selectedItem?.id === "github-issue") {
      setPage("github-issue");
      setSelectedItemId(null);
    } else {
      selectedItem?.onSelect();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    const allItems = currentGroups.flatMap((group) => group.items).filter((item) => !item.hidden);
    const currentIndex = allItems.findIndex((item) => item.id === selectedItemId);

    const updateSelection = (newIndex: number) => {
      e.preventDefault();
      const newId = allItems[newIndex]?.id ?? null;
      setSelectedItemId(newId);
    };

    switch (e.key) {
      case "ArrowDown":
        if (currentIndex === -1) {
          updateSelection(0);
        } else {
          updateSelection((currentIndex + 1) % allItems.length);
        }
        break;
      case "ArrowUp":
        if (currentIndex === -1) {
          updateSelection(allItems.length - 1);
        } else {
          updateSelection((currentIndex - 1 + allItems.length) % allItems.length);
        }
        break;
      case "ArrowLeft":
        if (page === "previous-replies" || page === "assignees" || page === "github-issue") {
          e.preventDefault();
          setPage("main");
        }
        break;
      case "Enter":
        if (selectedItemId) {
          e.preventDefault();
          handleSelect(selectedItemId);
        }
        break;
      case "Escape":
        if (page === "previous-replies" || page === "assignees" || page === "github-issue") {
          setPage("main");
        } else {
          onOpenChange(false);
        }
        break;
      case "Backspace":
        if ((page === "previous-replies" || page === "assignees" || page === "github-issue") && !inputValue) {
          setPage("main");
        }
        break;
    }
  };

  const mainPageGroups = useMainPage({
    onGenerateDraft,
    onOpenChange,
    setPage,
    setSelectedItemId,
    onToggleCc,
  });

  const previousRepliesGroups = usePreviousRepliesPage({
    previousReplies,
    onInsertReply,
    onOpenChange,
    setPage,
  });

  const assigneesGroups = useAssigneesPage({
    orgMembers,
    currentUserId: currentUser?.id,
    onAssignTicket: assignTicket,
    onOpenChange,
  });

  const toolsPage = useToolsPage();

  const currentGroups = (() => {
    switch (page) {
      case "main":
        return mainPageGroups;
      case "previous-replies":
        return previousRepliesGroups;
      case "assignees":
        return assigneesGroups;
      case "notes":
        return [];
      case "tools":
        return toolsPage.groups;
      case "github-issue":
        return [];
      default:
        return mainPageGroups;
    }
  })();

  const selectedItem = currentGroups
    .flatMap((group) => group.items)
    .filter((item) => !item.hidden)
    .find((item) => item.id === selectedItemId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange} modal={false}>
      <DialogContent className="gap-0 p-0 shadow-2xl shadow-black max-w-[1100px] md:h-[600px] h-screen flex flex-col data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%] duration-200 focus:outline-none">
        <DialogTitle className="sr-only">Ticket Command Bar</DialogTitle>
        <DialogDescription className="sr-only">
          Command bar for ticket actions and management. Use arrow keys to navigate, enter to select, and escape to
          close.
        </DialogDescription>
        {page === "notes" ? (
          <NotesPage onOpenChange={onOpenChange} />
        ) : page === "tools" && toolsPage.selectedTool ? (
          <ToolForm tool={toolsPage.selectedTool} onOpenChange={onOpenChange} />
        ) : page === "github-issue" ? (
          <GitHubIssuePage onOpenChange={onOpenChange} />
        ) : (
          <>
            <Command
              loop
              value={selectedItemId || ""}
              onValueChange={setSelectedItemId}
              className="flex-1 flex flex-col overflow-hidden [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted-foreground [&_[cmdk-group]:not([hidden])_~[cmdk-group]]:pt-0 [&_[cmdk-group]]:px-2 [&_[cmdk-input-wrapper]_svg]:h-5 [&_[cmdk-input-wrapper]_svg]:w-5 [&_[cmdk-input]]:h-12 [&_[cmdk-item]]:px-2 [&_[cmdk-item]]:py-3 [&_[cmdk-item]_svg]:h-5 [&_[cmdk-item]_svg]:w-5"
              filter={(value, search) => (value.toLowerCase().includes(search.toLowerCase()) ? 1 : 0)}
            >
              <CommandInput
                placeholder={
                  page === "main"
                    ? "Type a command or search actions..."
                    : page === "tools"
                      ? "Search tools..."
                      : "Search previous replies..."
                }
                value={inputValue}
                onValueChange={setInputValue}
                onKeyDown={handleKeyDown}
              />
              <div className="flex-1 grid md:grid-cols-3 grid-cols-1 overflow-hidden">
                <div className="flex-1 flex-col min-h-0">
                  <CommandList
                    isLoading={isLoadingPreviousReplies}
                    page={page}
                    groups={currentGroups}
                    selectedItemId={selectedItemId}
                    onSelect={handleSelect}
                    onMouseEnter={setSelectedItemId}
                  />
                </div>
                <div className="col-span-2 border-l overflow-y-auto md:block hidden">
                  {selectedItem?.preview ?? (
                    <div className="p-4 text-center text-sm text-muted-foreground">
                      <p>Select an item to see more details</p>
                    </div>
                  )}
                </div>
              </div>
            </Command>
            <div className="flex-shrink-0 border-t border-border p-2 text-xs text-muted-foreground flex items-center justify-center gap-3">
              <div className="flex items-center gap-1">
                <kbd className="px-1.5 py-0.5 rounded border bg-muted">↑↓</kbd>
                <span>to navigate</span>
              </div>
              <div className="flex items-center gap-1">
                <kbd className="px-1.5 py-0.5 rounded border bg-muted">⏎</kbd>
                <span>to select</span>
              </div>
              <div className="flex items-center gap-1">
                <kbd className="px-1.5 py-0.5 rounded border bg-muted">←</kbd>
                <span>{page === "previous-replies" ? "Move to parent" : "Move back"}</span>
              </div>
              <div className="flex items-center gap-1">
                <kbd className="px-1.5 py-0.5 rounded border bg-muted">Esc</kbd>
                <span>to close</span>
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
