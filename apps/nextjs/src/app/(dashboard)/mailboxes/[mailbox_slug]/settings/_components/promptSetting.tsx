"use client";

import { PlusCircleIcon } from "@heroicons/react/24/outline";
import { useRouter } from "next/navigation";
import SectionWrapper from "@/app/(dashboard)/mailboxes/[mailbox_slug]/settings/_components/sectionWrapper";
import type { PromptLineUpdate } from "@/app/types/global";
import { toast } from "@/components/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { api } from "@/trpc/react";
import PromptLineItem from "./promptLineItem";
import { useSettings } from "./useSettings";

type PromptSettingProps = {
  mailboxSlug: string;
  promptLines?: string[];
  onChange: (pendingUpdate: PromptLineUpdate[]) => void;
  pendingUpdates?: PromptLineUpdate[];
};

const PromptSetting = ({ mailboxSlug, promptLines, onChange, pendingUpdates }: PromptSettingProps) => {
  const { addNewRow, deleteNewRow, newRows, handleChange } = useSettings<PromptLineUpdate>(onChange, pendingUpdates);
  const router = useRouter();
  const { mutateAsync: updateMailboxMutation } = api.mailbox.update.useMutation();

  const deletePromptLine = async (idx: number) => {
    if (confirm("Are you sure you want to delete this prompt line?")) {
      try {
        const newPromptLines = promptLines?.filter((content, i) => content && i !== idx) || [];
        await updateMailboxMutation({
          mailboxSlug,
          responseGeneratorPrompt: newPromptLines,
        });
        router.refresh();
        toast({
          title: "Prompt deleted!",
          variant: "success",
        });
      } catch (error) {
        toast({
          title: "Error deleting prompt",
          variant: "destructive",
        });
      }
    }
  };

  return (
    <SectionWrapper
      title="Prompt Configuration"
      description="Tell Helper about your business and provide general writing instructions so it can draft authentic replies for you"
    >
      <div>
        {promptLines?.map((content, i) => (
          <PromptLineItem
            key={i}
            promptLine={{ lineIndex: i, content }}
            onChange={(value) => handleChange(i, value)}
            onDelete={() => deletePromptLine(i)}
          />
        ))}
        {newRows.map((row, i) => (
          <PromptLineItem
            key={row.key}
            promptLine={{
              lineIndex: (promptLines?.length ?? 0) + i,
              content: "",
            }}
            onChange={(value) => handleChange(row.key, value)}
            onDelete={() => deleteNewRow(row.key)}
            autoFocus={i === newRows.length - 1}
            isNew
          />
        ))}
      </div>

      <Button
        variant="subtle"
        onClick={(e) => {
          e.preventDefault();
          addNewRow();
        }}
      >
        <PlusCircleIcon className="mr-2 h-4 w-4" />
        Add prompt line
      </Button>
    </SectionWrapper>
  );
};

export default PromptSetting;
