"use client";

import { MagnifyingGlassIcon } from "@heroicons/react/20/solid";
import { CheckIcon, CurrencyDollarIcon, InboxIcon, ShieldExclamationIcon } from "@heroicons/react/24/outline";
import { omit, upperFirst } from "lodash";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { parseAsArrayOf, parseAsBoolean, parseAsString, parseAsStringEnum, useQueryStates } from "nuqs";
import { useEffect, useRef, useState } from "react";
import { highlightKeywords } from "@/app/(dashboard)/mailboxes/[mailbox_slug]/(inbox)/_components/highlightKeywords";
import { AssignedToLabel } from "@/app/(dashboard)/mailboxes/[mailbox_slug]/(inbox)/_components/list";
import { ConversationListItem } from "@/app/types/global";
import { DEFAULT_CONVERSATIONS_PER_PAGE } from "@/components/constants";
import { toast } from "@/components/hooks/use-toast";
import HumanizedTime from "@/components/humanizedTime";
import LoadingSpinner from "@/components/loadingSpinner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useDebouncedCallback } from "@/components/useDebouncedCallback";
import { formatCurrency } from "@/components/utils/currency";
import { api } from "@/trpc/react";
import { AssigneeFilter } from "./_components/assigneeFilter";
import { CustomerFilter } from "./_components/customerFilter";
import { DateFilter } from "./_components/dateFilter";
import { EventFilter } from "./_components/eventFilter";
import { ReactionFilter } from "./_components/reactionFilter";
import { ResponderFilter } from "./_components/responderFilter";
import { StatusFilter } from "./_components/statusFilter";
import { VipFilter } from "./_components/vipFilter";

export default function SearchPage() {
  const params = useParams<{ mailbox_slug: string }>();
  const router = useRouter();

  const [searchParams, setSearchParams] = useQueryStates({
    search: parseAsString,
    status: parseAsArrayOf(parseAsStringEnum(["open", "closed", "spam"] as const)),
    assignee: parseAsArrayOf(parseAsString),
    createdAfter: parseAsString,
    createdBefore: parseAsString,
    repliedBy: parseAsArrayOf(parseAsString),
    customer: parseAsArrayOf(parseAsString),
    isVip: parseAsBoolean,
    reactionType: parseAsStringEnum(["thumbs-up", "thumbs-down"] as const),
    events: parseAsArrayOf(parseAsStringEnum(["request_human_support", "resolved_by_ai"] as const)),
  });
  const debouncedSetSearchParams = useDebouncedCallback((newParams: Partial<typeof searchParams>) => {
    setSearchParams((params) => ({ ...params, ...newParams }));
  }, 300);
  const [filterValues, setFilterValues] = useState<typeof searchParams>(searchParams);
  const [selectedConversations, setSelectedConversations] = useState<number[]>([]);
  const [allConversationsSelected, setAllConversationsSelected] = useState(false);

  const isSearching = Object.values(omit(searchParams, "page")).some((value) =>
    Array.isArray(value) ? value.length > 0 : !!value,
  );

  const utils = api.useUtils();
  const searchOptions = {
    sort: "newest",
    category: null,
    search: searchParams.search ?? null,
    status: searchParams.status ?? null,
    assignee: searchParams.assignee ?? undefined,
    createdAfter: searchParams.createdAfter ?? undefined,
    createdBefore: searchParams.createdBefore ?? undefined,
    repliedBy: searchParams.repliedBy ?? undefined,
    customer: searchParams.customer ?? undefined,
    isVip: searchParams.isVip ?? undefined,
    reactionType: searchParams.reactionType ?? undefined,
    events: searchParams.events ?? undefined,
  };
  const { data, isFetching, hasNextPage, fetchNextPage } = api.mailbox.conversations.list.useInfiniteQuery(
    { mailboxSlug: params.mailbox_slug, ...searchOptions },
    {
      enabled: isSearching,
      getNextPageParam: (lastPage) => lastPage.nextCursor ?? null,
    },
  );

  const { mutateAsync: bulkUpdate, isPending: isBulkUpdating } = api.mailbox.conversations.bulkUpdate.useMutation({
    onError: () => {
      toast({
        variant: "destructive",
        title: "Failed to update conversations",
      });
    },
  });

  const searchResults = data?.pages.flatMap((page) => page.conversations) ?? [];
  const totalResults = data?.pages[data.pages.length - 1]?.total ?? 0;

  const updateFilter = (updates: Partial<typeof searchParams>) => {
    setFilterValues((prev) => ({ ...prev, ...updates }));
    debouncedSetSearchParams(updates);
  };

  const loadMoreRef = useRef<HTMLDivElement>(null);
  const resultsContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && hasNextPage && !isFetching) {
          void fetchNextPage();
        }
      },
      { rootMargin: "500px", root: resultsContainerRef.current },
    );

    if (loadMoreRef.current) {
      observer.observe(loadMoreRef.current);
    }

    return () => observer.disconnect();
  }, [hasNextPage, isFetching, fetchNextPage]);

  const toggleAllConversations = () => {
    if (allConversationsSelected || selectedConversations.length > 0) {
      setAllConversationsSelected(false);
      setSelectedConversations([]);
    } else {
      setAllConversationsSelected(true);
      setSelectedConversations([]);
    }
  };

  const toggleConversation = (id: number) => {
    if (allConversationsSelected) {
      setAllConversationsSelected(false);
      setSelectedConversations(searchResults.flatMap((c) => (c.id === id ? [] : [c.id])));
    } else {
      setSelectedConversations(
        selectedConversations.includes(id)
          ? selectedConversations.filter((selectedId) => selectedId !== id)
          : [...selectedConversations, id],
      );
    }
  };

  const handleBulkUpdate = async (status: "closed" | "spam") => {
    const conversationFilter = allConversationsSelected
      ? totalResults <= DEFAULT_CONVERSATIONS_PER_PAGE
        ? searchResults.map((c) => c.id)
        : searchOptions
      : selectedConversations;
    const { updatedImmediately } = await bulkUpdate({ conversationFilter, status, mailboxSlug: params.mailbox_slug });
    setAllConversationsSelected(false);
    setSelectedConversations([]);
    void utils.mailbox.conversations.list.invalidate();
    if (!updatedImmediately) {
      toast({ title: "Starting update, refresh to see status." });
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full">
      <div className="flex gap-2 justify-between border-b border-border px-2 py-4">
        <Button
          variant="ghost"
          iconOnly
          className="mt-1"
          onClick={() => {
            if (window.history.length > 1) {
              router.back();
            } else {
              router.push(`/mailboxes/${params.mailbox_slug}/conversations`);
            }
          }}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1 max-w-5xl mx-auto flex flex-col gap-3">
          <Input
            value={filterValues.search ?? ""}
            onChange={(e) => updateFilter({ search: e.target.value })}
            placeholder="Search conversations..."
            iconsSuffix={<MagnifyingGlassIcon className="h-5 w-5 text-muted-foreground" />}
            className="text-base px-4 py-3"
            autoFocus
          />
          <div className="flex gap-3 overflow-x-auto">
            <StatusFilter
              selectedStatuses={filterValues.status ?? []}
              onChange={(statuses) => updateFilter({ status: statuses })}
            />
            <DateFilter
              initialStartDate={filterValues.createdAfter}
              initialEndDate={filterValues.createdBefore}
              onSelect={(startDate, endDate) => {
                updateFilter({ createdAfter: startDate, createdBefore: endDate });
              }}
            />
            <AssigneeFilter
              selectedAssignees={filterValues.assignee ?? []}
              onChange={(assignees) => updateFilter({ assignee: assignees })}
            />
            <ResponderFilter
              selectedResponders={filterValues.repliedBy ?? []}
              onChange={(responders) => updateFilter({ repliedBy: responders })}
            />
            <CustomerFilter
              selectedCustomers={filterValues.customer ?? []}
              onChange={(customers) => updateFilter({ customer: customers })}
            />
            <VipFilter isVip={filterValues.isVip ?? undefined} onChange={(isVip) => updateFilter({ isVip })} />
            <ReactionFilter
              reactionType={filterValues.reactionType}
              onChange={(reactionType) => updateFilter({ reactionType })}
            />
            <EventFilter selectedEvents={filterValues.events ?? []} onChange={(events) => updateFilter({ events })} />
          </div>
        </div>
        <div className="w-1 lg:w-10" />
      </div>

      <div className="flex-1 overflow-y-auto p-4" ref={resultsContainerRef}>
        {isSearching ? (
          searchResults.length === 0 && !isFetching ? (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
              <MagnifyingGlassIcon className="h-12 w-12 mb-4" />
              <p className="text-lg">No conversations found</p>
            </div>
          ) : (
            <div className="max-w-5xl mx-auto flex flex-col gap-2">
              {searchResults.length > 0 && (
                <div className="flex items-center gap-4 mb-2">
                  <TooltipProvider delayDuration={0}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="flex items-center gap-2">
                          <Checkbox
                            checked={allConversationsSelected || selectedConversations.length > 0}
                            onCheckedChange={toggleAllConversations}
                            id="select-all"
                            disabled={
                              !allConversationsSelected && !selectedConversations.length && totalResults > 10_000
                            }
                          />
                          <label htmlFor="select-all" className="text-sm text-muted-foreground">
                            {allConversationsSelected
                              ? "All conversations selected"
                              : selectedConversations.length > 0
                                ? `${selectedConversations.length} selected`
                                : "Select all"}
                          </label>
                        </div>
                      </TooltipTrigger>
                      {!allConversationsSelected && !selectedConversations.length && totalResults > 10_000 && (
                        <TooltipContent side="right">Up to 10,000 conversations can be updated at once</TooltipContent>
                      )}
                    </Tooltip>
                  </TooltipProvider>
                  {(allConversationsSelected || selectedConversations.length > 0) && (
                    <div className="flex items-center">
                      <Button
                        variant="link"
                        className="h-auto"
                        onClick={() => handleBulkUpdate("closed")}
                        disabled={isBulkUpdating}
                      >
                        Close
                      </Button>
                      <Button
                        variant="link"
                        className="h-auto"
                        onClick={() => handleBulkUpdate("spam")}
                        disabled={isBulkUpdating}
                      >
                        Mark as spam
                      </Button>
                    </div>
                  )}
                  <span className="ml-auto text-sm text-muted-foreground">{totalResults} results</span>
                </div>
              )}
              {searchResults.map((conversation) => (
                <SearchResultItem
                  key={conversation.id}
                  conversation={conversation}
                  searchTerms={searchParams.search?.split(" ").filter(Boolean) ?? []}
                  isSelected={allConversationsSelected || selectedConversations.includes(conversation.id)}
                  onToggleSelect={() => toggleConversation(conversation.id)}
                />
              ))}
              {isFetching && (
                <div className="flex justify-center p-4">
                  <LoadingSpinner size="md" />
                </div>
              )}
              {hasNextPage && <div ref={loadMoreRef} className="h-10" />}
            </div>
          )
        ) : null}
      </div>
    </div>
  );
}

function SearchResultItem({
  conversation,
  searchTerms,
  isSelected,
  onToggleSelect,
}: {
  conversation: ConversationListItem;
  searchTerms: string[];
  isSelected: boolean;
  onToggleSelect: () => void;
}) {
  const params = useParams<{ mailbox_slug: string }>();

  const status = conversation.status ?? "open";
  const StatusIcon = {
    open: InboxIcon,
    closed: CheckIcon,
    spam: ShieldExclamationIcon,
  }[status];

  let highlightedText = highlightKeywords(conversation.matchedMessageText?.replace(/\s+/g, " ") ?? "", searchTerms);
  const highlightIndex = highlightedText.indexOf("<mark");
  if (highlightIndex > 100) {
    const splitIndex = highlightedText.slice(0, highlightIndex - 100).lastIndexOf(" ");
    highlightedText = `...${highlightedText.slice(splitIndex === -1 ? 0 : splitIndex)}`;
  }

  return (
    <div className="flex items-start gap-2 p-4 rounded-lg border border-border hover:border-border/80">
      <Checkbox
        checked={isSelected}
        onCheckedChange={onToggleSelect}
        onClick={(e) => e.stopPropagation()}
        className="mt-0.5"
      />
      <Link href={`/mailboxes/${params.mailbox_slug}/conversations?id=${conversation.slug}`} className="flex-1">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="text-sm font-medium truncate">{conversation.emailFrom}</h3>
            </div>
            <div className="flex items-center gap-2">
              <TooltipProvider delayDuration={0}>
                <Tooltip>
                  <TooltipTrigger>
                    <StatusIcon className="h-4 w-4 text-muted-foreground" />
                  </TooltipTrigger>
                  <TooltipContent side="left">{upperFirst(status)}</TooltipContent>
                </Tooltip>
              </TooltipProvider>
              <p
                className="text-sm truncate"
                dangerouslySetInnerHTML={{ __html: highlightKeywords(conversation.subject, searchTerms) }}
              />
            </div>
            {highlightedText && (
              <p
                className="mt-1 text-sm text-muted-foreground line-clamp-2 whitespace-pre-wrap"
                dangerouslySetInnerHTML={{ __html: highlightedText }}
              />
            )}
          </div>
          <div className="flex items-center gap-3 flex-shrink-0">
            {conversation.assignedToClerkId && (
              <AssignedToLabel
                className="flex items-center gap-1 text-xs text-muted-foreground"
                assignedToClerkId={conversation.assignedToClerkId}
              />
            )}
            {conversation.platformCustomer?.isVip && <Badge variant="yellow">VIP</Badge>}
            {conversation.platformCustomer?.value && (
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <CurrencyDollarIcon className="h-3 w-3" />
                {formatCurrency(parseFloat(conversation.platformCustomer.value))}
              </div>
            )}
            <div className="text-xs text-muted-foreground">
              <HumanizedTime
                time={conversation.lastUserEmailCreatedAt ?? conversation.updatedAt}
                titlePrefix="Last email received on"
              />
            </div>
          </div>
        </div>
      </Link>
    </div>
  );
}
