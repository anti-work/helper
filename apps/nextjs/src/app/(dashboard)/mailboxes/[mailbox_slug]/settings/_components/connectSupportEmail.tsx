import { useParams, useRouter } from "next/navigation";
import { useQueryState } from "nuqs";
import SectionWrapper from "@/app/(dashboard)/mailboxes/[mailbox_slug]/settings/_components/sectionWrapper";
import type { SupportAccount } from "@/app/types/global";
import { HELPER_SUPPORT_EMAIL_FROM } from "@/components/constants";
import { Button } from "@/components/ui/button";
import { api } from "@/trpc/react";

const ConnectSupportEmail = ({ supportAccount }: { supportAccount?: SupportAccount }) => {
  const params = useParams();
  const router = useRouter();
  const [error] = useQueryState("error");
  const { mutateAsync: deleteSupportEmailMutation } = api.gmailSupportEmail.delete.useMutation();

  const handleConnectOrDisconnect = async () => {
    if (supportAccount) {
      if (
        confirm(
          "Are you sure you want to disconnect Gmail? You will still have access to all of your emails in Helper, but you will not be able to send/receive new emails until you connect a new Gmail account.",
        )
      ) {
        await deleteSupportEmailMutation({ mailboxSlug: params.mailbox_slug as string });
        router.refresh();
      }
    } else {
      location.href = `/api/connect/google?mailbox=${params.mailbox_slug}`;
    }
  };

  return (
    <SectionWrapper
      title="Connect Your Support Email"
      description="Connect your support email to receive and send emails from your support email address."
    >
      {error && (
        <div className="mb-4 rounded-lg bg-destructive-100 px-4 py-3 text-destructive-900" role="alert">
          <h3>Failed to connect your gmail account, please try again.</h3>
          <p className="mt-1 text-sm">
            If the issue still persists please contact{" "}
            <a className="underline" href={`mailto:${HELPER_SUPPORT_EMAIL_FROM}`}>
              {HELPER_SUPPORT_EMAIL_FROM}
            </a>
          </p>
        </div>
      )}
      <Button variant={supportAccount ? "destructive_outlined" : "subtle"} onClick={handleConnectOrDisconnect}>
        {supportAccount ? `Disconnect ${supportAccount.email}` : "Connect your Gmail"}
      </Button>
    </SectionWrapper>
  );
};

export default ConnectSupportEmail;
