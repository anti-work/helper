import { TrashIcon } from "@heroicons/react/24/outline";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Linter, LinterUpdate } from "@/app/types/global";
import { toast } from "@/components/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { api } from "@/trpc/react";
import LinterForm from "./linterForm";

type LinterItemProps = {
  mailboxSlug: string;
  linter: Linter;
  onDelete: () => void;
  onClickEdit: () => void;
};

const LinterItem = ({ mailboxSlug, linter, onDelete, onClickEdit }: LinterItemProps) => {
  const [isEditing, setIsEditing] = useState(false);
  const router = useRouter();
  const { mutateAsync: upsertStyleLinterMutation } = api.mailbox.styleLinters.upsert.useMutation();

  const handleStartEditing = () => {
    setIsEditing(true);
  };

  const handleSubmit = async (linterUpdate: LinterUpdate) => {
    try {
      await upsertStyleLinterMutation({
        mailboxSlug,
        linter: { id: linterUpdate.id, before: linterUpdate.before ?? "", after: linterUpdate.after ?? "" },
      });
      router.refresh();
    } catch (error) {
      toast({ title: "Error updating example", variant: "destructive" });
    }
    setIsEditing(false);
  };

  return (
    <div data-linter-item className="&:not(:last-child):border-b mb-2">
      {isEditing ? (
        <LinterForm linter={linter} onSubmit={handleSubmit} onCancel={() => setIsEditing(false)} autoFocusBefore />
      ) : (
        <div className="flex justify-between gap-2">
          <button
            type="button"
            className="w-full text-left text-sm hover:underline"
            onClick={(e) => {
              e.preventDefault();
              handleStartEditing();
            }}
          >
            <div className="line-clamp-2">{linter.after}</div>
          </button>
          <div>
            <Button
              variant="ghost"
              size="sm"
              iconOnly
              onClick={(e) => {
                e.preventDefault();
                onDelete();
              }}
            >
              <TrashIcon className="h-4 w-4" />
              <span className="sr-only">Delete</span>
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default LinterItem;
