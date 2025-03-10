import { MagnifyingGlassIcon } from "@heroicons/react/20/solid";
import { CurrencyDollarIcon, UserIcon } from "@heroicons/react/24/outline";
import { PaperAirplaneIcon } from "@heroicons/react/24/solid";
import { ChannelProvider } from "ably/react";
import { capitalize } from "lodash";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useQueryState } from "nuqs";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import scrollIntoView from "scroll-into-view-if-needed";
import { useLayoutInfo } from "@/app/(dashboard)/mailboxes/[mailbox_slug]/_components/useLayoutInfo";
import NewConversationModalContent from "@/app/(dashboard)/mailboxes/[mailbox_slug]/(inbox)/_components/newConversationModal";
import { ConversationListItem } from "@/app/types/global";
import { DEFAULT_CONVERSATIONS_PER_PAGE } from "@/components/constants";
import HumanizedTime from "@/components/humanizedTime";
import LoadingSpinner from "@/components/loadingSpinner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatCurrency } from "@/components/utils/currency";
import { conversationsListChannelId } from "@/lib/ably/channels";
import { useAblyEvent } from "@/lib/ably/hooks";
import { formatNumber } from "@/lib/format";
import { generateSlug } from "@/lib/shared/slug";
import { cn } from "@/lib/utils";
import { api } from "@/trpc/react";
import { useConversationListContext } from "./conversationListContext";
import { useConversationsListInput } from "./shared/queries";

type ListItem = ConversationListItem & { isNew?: boolean };

type ListItemProps = {
  conversation: ListItem;
  isActive: boolean;
  onSelectConversation: (slug: string) => void;
  variant: "desktop" | "mobile";
};

type StatusOption = "open" | "closed" | "spam";
type SortOption = "oldest" | "newest" | "highest_value";

const SearchBar = ({
  statusOptions,
  sortOptions,
  onStatusChange,
  onSortChange,
  variant,
}: {
  statusOptions: { value: StatusOption; label: string; selected: boolean }[];
  sortOptions: { value: SortOption; label: string; selected: boolean }[];
  onStatusChange: (status: StatusOption) => void;
  onSortChange: (sort: SortOption) => void;
  variant: "desktop" | "mobile";
}) => {
  const params = useParams<{ mailbox_slug: string }>();

  return (
    <div className={cn("border-b", variant === "desktop" ? "border-sidebar-border" : "border-border")}>
      <div className="flex items-center justify-between gap-2 px-4 pb-1">
        <div className="flex items-center gap-2">
          {statusOptions.length > 1 ? (
            <Select value={statusOptions.find(({ selected }) => selected)?.value || ""} onValueChange={onStatusChange}>
              <SelectTrigger
                variant="bare"
                className={cn(
                  "font-sundry-regular",
                  variant === "desktop" ? "text-white [&>svg]:text-white" : "text-foreground [&>svg]:text-foreground",
                )}
              >
                <SelectValue placeholder="Select status" />
              </SelectTrigger>
              <SelectContent>
                {statusOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value} className="font-sundry-regular">
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : statusOptions[0] ? (
            <div
              className={cn("text-sm font-sundry-regular", variant === "desktop" ? "text-white" : "text-foreground")}
            >
              {statusOptions[0].label}
            </div>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          <Select value={sortOptions.find(({ selected }) => selected)?.value || ""} onValueChange={onSortChange}>
            <SelectTrigger
              variant="bare"
              className={cn(
                "font-sundry-regular",
                variant === "desktop" ? "text-white [&>svg]:text-white" : "text-foreground [&>svg]:text-foreground",
              )}
            >
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent>
              {sortOptions.map((option) => (
                <SelectItem key={option.value} value={option.value} className="font-sundry-regular">
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant="ghost"
            size="sm"
            iconOnly
            desktop={variant === "desktop"}
            aria-label="Search"
            className="flex-none w-8"
            asChild
          >
            <Link href={`/mailboxes/${params.mailbox_slug}/search`}>
              <MagnifyingGlassIcon
                className={cn("h-4 w-4", variant === "desktop" ? "text-white" : "text-foreground")}
              />
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
};

const ListContent = ({ variant }: { variant: "desktop" | "mobile" }) => {
  const [conversationSlug] = useQueryState("id");
  const { searchParams, input } = useConversationsListInput();
  const { conversationListData, navigateToConversation, isPending, isFetchingNextPage, hasNextPage, fetchNextPage } =
    useConversationListContext();
  const category =
    useParams<{ category: "conversations" | "mine" | "assigned" | "unassigned" | undefined }>().category ||
    "conversations";

  const conversations = conversationListData?.conversations ?? [];
  const total = conversationListData?.total ?? 0;
  const { data: countData } = api.mailbox.countByStatus.useQuery({ mailboxSlug: input.mailboxSlug });
  const status = countData
    ? (["open", "closed", "spam"] as const)
        .map((status) => ({
          status,
          count: countData[category][status] ?? 0,
        }))
        .filter((c) => c.count > 0 || c.status === "open")
    : [];
  const defaultSort = conversationListData?.defaultSort;

  const { handleStatusFilterChange, handleSortChange } = useFilterHandlers();

  const loadMoreRef = useRef<HTMLDivElement>(null);
  const resultsContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const currentRef = loadMoreRef.current;
    if (!currentRef || !hasNextPage) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && !isFetchingNextPage) {
          fetchNextPage();
        }
      },
      { rootMargin: "500px", root: resultsContainerRef.current },
    );

    observer.observe(currentRef);
    return () => observer.disconnect();
  }, [fetchNextPage, hasNextPage, isFetchingNextPage]);

  const statusOptions = useMemo(() => {
    const statuses = status.flatMap((status) =>
      status.status
        ? {
            value: status.status,
            label:
              status.status === "closed" || status.status === "spam"
                ? capitalize(status.status)
                : `${formatNumber(status.count)} ${capitalize(status.status)}`,
            selected: searchParams.status ? searchParams.status == status.status : status.status === "open",
          }
        : [],
    );

    if (searchParams.status) {
      if (!statuses.some((s) => s.value === searchParams.status)) {
        statuses.push({
          value: searchParams.status,
          label:
            searchParams.status === "closed" || searchParams.status === "spam"
              ? capitalize(searchParams.status)
              : `0 ${capitalize(searchParams.status)}`,
          selected: true,
        });
      }
    }

    return statuses;
  }, [status, searchParams]);

  const sortOptions = useMemo(
    () => [
      ...(defaultSort === "highest_value"
        ? [
            {
              value: `highest_value` as const,
              label: `Highest Value`,
              selected: searchParams.sort ? searchParams.sort == "highest_value" : true,
            },
          ]
        : []),
      {
        value: `oldest` as const,
        label: `Oldest`,
        selected: searchParams.sort ? searchParams.sort === "oldest" : defaultSort === "oldest",
      },
      {
        value: `newest` as const,
        label: `Newest`,
        selected: searchParams.sort == "newest",
      },
    ],
    [defaultSort, searchParams],
  );

  const utils = api.useUtils();
  useAblyEvent(conversationsListChannelId(input.mailboxSlug), "conversation.new", (message) => {
    const newConversation = message.data as ConversationListItem;
    if (newConversation.status !== (searchParams.status ?? "open")) return;
    const sort = searchParams.sort ?? defaultSort;
    if (!sort) return;

    utils.mailbox.conversations.list.setInfiniteData({ ...input, limit: DEFAULT_CONVERSATIONS_PER_PAGE }, (data) => {
      if (!data) return undefined;
      const firstPage = data.pages[0];
      if (!firstPage) return data;

      switch (input.category) {
        case "conversations":
          break;
        case "assigned":
          if (!newConversation.assignedToClerkId) return data;
          break;
        case "unassigned":
          if (newConversation.assignedToClerkId) return data;
          break;
        case "mine":
          if (newConversation.assignedToClerkId !== firstPage.assignedToClerkIds?.[0]) return data;
          break;
      }

      const existingConversationIndex = firstPage.conversations.findIndex(
        (conversation) => conversation.slug === newConversation.slug,
      );

      const newConversations: ListItem[] = [...firstPage.conversations];
      if (existingConversationIndex >= 0) newConversations.splice(existingConversationIndex, 1);

      switch (sort) {
        case "newest":
          newConversations.unshift({ ...newConversation, isNew: true });
          break;
        case "oldest":
          // Only add to first page if no other pages exist
          if (data.pages.length === 1) {
            newConversations.push({ ...newConversation, isNew: true });
          }
          break;
        case "highest_value":
          const indexToInsert =
            existingConversationIndex >= 0
              ? existingConversationIndex
              : newConversations.findIndex(
                  (c) => (c.platformCustomer?.value ?? 0) < (newConversation.platformCustomer?.value ?? 0),
                );
          if (indexToInsert < 0) return data;
          newConversations.splice(indexToInsert, 0, { ...newConversation, isNew: true });
          break;
      }

      return {
        ...data,
        pages: [{ ...firstPage, conversations: newConversations }, ...data.pages.slice(1)],
      };
    });
  });
  useAblyEvent(conversationsListChannelId(input.mailboxSlug), "conversation.statusChanged", (message) => {
    const currentStatus = searchParams.status;
    if (message.data.status === currentStatus) return;

    utils.mailbox.conversations.list.setInfiniteData({ ...input, limit: DEFAULT_CONVERSATIONS_PER_PAGE }, (data) => {
      if (!data) return undefined;
      const firstPage = data.pages[0];
      if (!firstPage) return data;

      const updatedPages = data.pages.map((page) => {
        const updatedConversations = page.conversations.filter((c) => c.id !== message.data.id);
        if (updatedConversations.length === page.conversations.length) return page;

        return {
          ...page,
          conversations: updatedConversations,
          total: page.total - 1,
          // Status is now handled by statusCounts query
        };
      });

      return {
        ...data,
        pages: updatedPages,
      };
    });
  });

  const searchBar = (
    <SearchBar
      statusOptions={statusOptions}
      sortOptions={sortOptions}
      onStatusChange={handleStatusFilterChange}
      onSortChange={handleSortChange}
      variant={variant}
    />
  );

  if (!conversationListData)
    return (
      <>
        {searchBar}
        <LoadingSpinner size="md" className="m-auto" />
      </>
    );

  return (
    <>
      {searchBar}
      <div className="relative h-full flex flex-col">
        <div
          className="flex-1 overflow-y-auto mt-2 md:border-b md:border-sidebar-border h-[calc(100%-50px)]"
          ref={resultsContainerRef}
        >
          <div className="flex w-full flex-col">
            {conversations.map((conversation, index) => (
              <ListItem
                key={index}
                conversation={conversation}
                isActive={conversation.slug === conversationSlug}
                onSelectConversation={() => navigateToConversation(conversation.slug)}
                variant={variant}
              />
            ))}
            {hasNextPage && (
              <div ref={loadMoreRef} className="h-8 flex items-center justify-center">
                {isFetchingNextPage && <LoadingSpinner size="sm" />}
              </div>
            )}
          </div>
        </div>
        {total > 0 && (
          <div className="sticky bottom-4 right-4 z-10 self-end">
            <NewConversationModal />
          </div>
        )}
      </div>
    </>
  );
};

export const List = ({ mailboxSlug, variant = "desktop" }: { mailboxSlug: string; variant?: "desktop" | "mobile" }) => {
  return (
    <ChannelProvider channelName={conversationsListChannelId(mailboxSlug)}>
      <ListContent variant={variant} />
    </ChannelProvider>
  );
};

function useFilterHandlers() {
  const { searchParams, setSearchParams } = useConversationsListInput();
  const [, setId] = useQueryState("id");

  const handleStatusFilterChange = useCallback(
    (status: StatusOption) => {
      setId(null);

      if (status === "open") {
        setSearchParams({ status: null, sort: null });
      } else {
        setSearchParams({ status, sort: "newest" });
      }
    },
    [searchParams, setId, setSearchParams],
  );

  const handleSortChange = useCallback(
    (sort: SortOption) => {
      setSearchParams({ sort });
      setId(null);
    },
    [setId, setSearchParams],
  );

  return { handleStatusFilterChange, handleSortChange };
}

const NewConversationModal = () => {
  const { setState: setLayoutState } = useLayoutInfo();
  const params = useParams<{ mailbox_slug: string }>();
  const mailboxSlug = params.mailbox_slug;

  const [newConversationModalOpen, setNewConversationModalOpen] = useState(false);
  const [newConversationSlug, setNewConversationSlug] = useState(generateSlug());
  useEffect(() => {
    if (newConversationModalOpen) setNewConversationSlug(generateSlug());
  }, [newConversationModalOpen]);

  const closeModal = () => setNewConversationModalOpen(false);

  return (
    <Dialog open={newConversationModalOpen} onOpenChange={setNewConversationModalOpen}>
      <DialogTrigger asChild>
        <Button
          variant="default"
          iconOnly
          className="rounded-full text-primary-foreground dark:bg-bright dark:text-bright-foreground bg-bright hover:bg-bright/90 hover:text-background"
        >
          <PaperAirplaneIcon className="text-primary dark:text-primary-foreground h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New message</DialogTitle>
        </DialogHeader>
        <NewConversationModalContent
          mailboxSlug={mailboxSlug}
          conversationSlug={newConversationSlug}
          onSubmit={closeModal}
        />
      </DialogContent>
    </Dialog>
  );
};

const ListItem = ({ conversation, isActive, onSelectConversation, variant }: ListItemProps) => {
  const listItemRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isActive && listItemRef.current) {
      scrollIntoView(listItemRef.current, {
        block: "nearest",
        scrollMode: "if-needed",
        behavior: "smooth",
      });
    }
  }, [conversation, isActive]);

  return (
    <div className="px-2 py-0.5">
      <div
        ref={listItemRef}
        className={cn(
          "flex w-full cursor-pointer flex-col gap-0.5 px-2 py-2 rounded-lg transition-colors",
          variant === "desktop"
            ? isActive
              ? "bg-sidebar-accent"
              : "hover:bg-sidebar-accent"
            : isActive
              ? "bg-accent"
              : "hover:bg-accent/50",
        )}
        onClick={() => onSelectConversation(conversation.slug)}
        style={{ overflowAnchor: "none" }}
      >
        <div className="flex justify-between gap-2">
          <div
            className={cn(
              "line-clamp-1 break-all text-sm font-sundry-medium",
              variant === "desktop" ? "text-sidebar-foreground" : "text-foreground",
            )}
          >
            {conversation.emailFrom ?? "Anonymous"}
          </div>
          <div className="flex items-center justify-center space-x-1 text-right">
            <div
              className={cn(
                "whitespace-nowrap text-xs font-sundry-regular",
                variant === "desktop" ? "text-sidebar-foreground/50" : "text-muted-foreground",
              )}
            >
              {conversation.status === "closed" ? (
                <>
                  <HumanizedTime time={conversation.closedAt ?? conversation.updatedAt} titlePrefix="Closed on" />
                </>
              ) : (
                <HumanizedTime
                  time={conversation.lastUserEmailCreatedAt ?? conversation.updatedAt}
                  titlePrefix="Last email received on"
                />
              )}
            </div>
            {conversation.isNew && <div className="h-[0.5rem] w-[0.5rem] rounded-full bg-blue-500" />}
          </div>
        </div>
        <div className="flex gap-2">
          <div className="min-w-0 flex-1">
            <div
              className={cn(
                "line-clamp-1 text-xs font-sundry-regular",
                variant === "desktop" ? "text-sidebar-foreground/80" : "text-muted-foreground",
              )}
            >
              {conversation.subject}
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {conversation.assignedToClerkId && (
              <AssignedToLabel
                className={cn(
                  "shrink-0 break-all flex items-center gap-1 text-xs font-sundry-regular",
                  variant === "desktop" ? "text-sidebar-foreground/50" : "text-muted-foreground",
                )}
                assignedToClerkId={conversation.assignedToClerkId}
              />
            )}
            {conversation.platformCustomer?.isVip && (
              <div
                className={cn(
                  "shrink-0 text-right font-sundry-regular",
                  variant === "desktop" ? "text-sidebar-foreground/50" : "text-muted-foreground",
                )}
                title="VIP Customer"
              >
                <div className="flex items-center gap-1 text-xs">
                  <Badge variant="yellow">VIP</Badge>
                </div>
              </div>
            )}
            {conversation.platformCustomer?.value ? (
              <div
                className={cn(
                  "shrink-0 text-right font-sundry-regular",
                  variant === "desktop" ? "text-sidebar-foreground/50" : "text-muted-foreground",
                )}
                title={`Value: ${conversation.platformCustomer.value}`}
              >
                <div className="flex items-center gap-1 text-xs">
                  <CurrencyDollarIcon className="h-3 w-3" />
                  {formatCurrency(parseFloat(conversation.platformCustomer.value))}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
};

export const AssignedToLabel = ({
  assignedToClerkId,
  className,
}: {
  assignedToClerkId: string;
  className?: string;
}) => {
  const { data: members } = api.organization.getMembers.useQuery(undefined, {
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });

  const displayName = members?.find((m) => m.id === assignedToClerkId)?.displayName?.split(" ")[0];

  return displayName ? (
    <div className={className} title={`Assigned to ${displayName}`}>
      <UserIcon className="h-3 w-3" />
      {displayName}
    </div>
  ) : null;
};
