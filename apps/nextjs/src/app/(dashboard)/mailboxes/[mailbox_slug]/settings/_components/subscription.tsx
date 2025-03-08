import Link from "next/link";
import { useParams } from "next/navigation";
import { parseAsString, useQueryStates } from "nuqs";
import SectionWrapper from "@/app/(dashboard)/mailboxes/[mailbox_slug]/settings/_components/sectionWrapper";
import { toast } from "@/components/hooks/use-toast";
import LoadingSpinner from "@/components/loadingSpinner";
import { Button } from "@/components/ui/button";
import { useRunOnce } from "@/components/useRunOnce";
import { api } from "@/trpc/react";

const Subscription = () => {
  const { mailbox_slug: mailboxSlug } = useParams<{ mailbox_slug: string }>();
  const [searchParams, setSearchParams] = useQueryStates({
    stripeStatus: parseAsString,
    stripeSessionId: parseAsString,
  });

  const { data: subscription, isLoading, refetch } = api.subscription.get.useQuery({ mailboxSlug });
  const { mutate: handleSuccessfulSubscription } = api.subscription.subscribe.useMutation({
    onSuccess: (res) => {
      if (res.success) {
        setSearchParams({ stripeStatus: null, stripeSessionId: null });
        refetch();
        toast({
          title: res.message,
          variant: "success",
        });
      } else {
        toast({
          title: res.message,
          variant: "destructive",
        });
      }
    },
  });

  const { mutate: subscribe } = api.subscription.startCheckout.useMutation({
    onSuccess: (data) => {
      window.location.href = data.url;
    },
  });

  const { mutate: manageSubscription } = api.subscription.manage.useMutation({
    onSuccess: (data) => {
      window.location.href = data.url;
    },
  });

  useRunOnce(() => {
    if (searchParams.stripeStatus === "success" && searchParams.stripeSessionId) {
      handleSuccessfulSubscription({ mailboxSlug, sessionId: searchParams.stripeSessionId });
    }
  });

  return (
    <SectionWrapper title="Subscription" description="Manage your Helper subscription">
      {isLoading ? (
        <LoadingSpinner size="md" />
      ) : subscription ? (
        <div className="flex flex-col gap-4 text-sm">
          <div>
            <h2 className="font-medium text-xl">Helper Subscription</h2>
            <p className="text-muted-foreground">${(subscription.unitAmount / 100).toFixed(2)} per resolution</p>
          </div>
          <div className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2">
            <span className="font-medium">Current billing period</span>
            <span>
              {subscription.currentPeriodStart.toLocaleDateString()} -{" "}
              {subscription.currentPeriodEnd.toLocaleDateString()}
            </span>
            <span className="font-medium">AI resolutions</span>
            <span>
              {subscription.aiResolutions}{" "}
              <Link
                href={`/mailboxes/${mailboxSlug}/search?events=resolved_by_ai`}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                (View)
              </Link>
            </span>
          </div>
          <div>
            <Button variant="outlined" onClick={() => manageSubscription({ mailboxSlug })}>
              Manage subscription
            </Button>
          </div>
        </div>
      ) : (
        <Button variant="subtle" onClick={() => subscribe({ mailboxSlug })}>
          Subscribe
        </Button>
      )}
    </SectionWrapper>
  );
};

export default Subscription;
