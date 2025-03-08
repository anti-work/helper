"use client";

import { PlusCircleIcon } from "@heroicons/react/24/outline";
import dynamic from "next/dynamic";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import type { Linter, LinterUpdate } from "@/app/types/global";
import { MAX_STYLE_LINTERS } from "@/components/constants";
import { toast } from "@/components/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { api } from "@/trpc/react";
import LinterForm from "./linterForm";
import SectionWrapper from "./sectionWrapper";

const LinterItem = dynamic(() => import("@/app/(dashboard)/mailboxes/[mailbox_slug]/settings/_components/linterItem"), {
  loading: () => (
    <div className="animate-default-pulse mb-5 h-4 w-full rounded-full bg-border dark:bg-neutral-700"></div>
  ),
  ssr: false,
});

type StyleLinterSettingProps = {
  isLinterEnabled: boolean;
  linters: Linter[];
};

const emptyLinter = {
  before: "",
  after: "",
};

const StyleLinterSetting = ({ isLinterEnabled, linters }: StyleLinterSettingProps) => {
  const params = useParams<{ mailbox_slug: string }>();
  const router = useRouter();
  const [showModal, setShowModal] = useState(false);
  const [newLinter, setNewLinter] = useState<LinterUpdate>(emptyLinter);

  const { mutateAsync: upsertStyleLinterMutation } = api.mailbox.styleLinters.upsert.useMutation();
  const { mutateAsync: deleteStyleLinterMutation } = api.mailbox.styleLinters.delete.useMutation();

  const handleDelete = async (id: number) => {
    if (confirm("Are you sure you want to delete this style linter?")) {
      try {
        await deleteStyleLinterMutation({ mailboxSlug: params.mailbox_slug, id });
        router.refresh();
        toast({
          title: "Example deleted!",
          variant: "success",
        });
      } catch (error) {
        toast({
          title: "Error deleting example",
          variant: "destructive",
        });
      }
    }
  };

  const handleSubmit = async (linterUpdate: LinterUpdate) => {
    try {
      await upsertStyleLinterMutation({
        mailboxSlug: params.mailbox_slug,
        linter: { id: linterUpdate.id, before: linterUpdate.before ?? "", after: linterUpdate.after ?? "" },
      });
      router.refresh();
    } catch (error) {
      toast({ title: "Error creating example", variant: "destructive" });
    }
    setShowModal(false);
  };

  const { mutate: toggleStyleLinter } = api.mailbox.styleLinters.setEnabled.useMutation({
    onSuccess: (_, { enabled }) =>
      toast({
        title: `Style linter is now ${enabled ? "enabled" : "disabled"}`,
        variant: "success",
      }),
    onError: () =>
      toast({
        title: "Error updating style linter status",
        variant: "destructive",
      }),
  });

  return (
    <>
      <SectionWrapper
        title="Style Linter"
        description={`Rewrite up to ${MAX_STYLE_LINTERS} of Helper's previous drafts so future drafts sound more like you`}
        initialSwitchChecked={isLinterEnabled}
        onSwitchChange={(enabled) => toggleStyleLinter({ mailboxSlug: params.mailbox_slug, enabled })}
      >
        <div className="divide-y divide-border [&>:not(:first-child)]:pt-2">
          {linters.map((linter) => (
            <LinterItem
              key={linter.id}
              mailboxSlug={params.mailbox_slug}
              linter={linter}
              onDelete={() => handleDelete(linter.id)}
              onClickEdit={() => {
                setNewLinter({ ...linter });
                setShowModal(true);
              }}
            />
          ))}
        </div>
        {linters.length < 8 ? (
          showModal ? (
            <LinterForm
              linter={newLinter}
              onSubmit={handleSubmit}
              onCancel={() => {
                setNewLinter(emptyLinter);
                setShowModal(false);
              }}
              autoFocusBefore
            />
          ) : (
            <Button
              variant="subtle"
              onClick={() => {
                setNewLinter(emptyLinter);
                setShowModal(true);
              }}
            >
              <PlusCircleIcon className="mr-2 h-4 w-4" />
              Add example
            </Button>
          )
        ) : null}
      </SectionWrapper>
    </>
  );
};

export default StyleLinterSetting;
