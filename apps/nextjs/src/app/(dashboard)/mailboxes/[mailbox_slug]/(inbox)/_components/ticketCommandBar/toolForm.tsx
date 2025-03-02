import { useState } from "react";
import { formatParameter } from "@/app/(dashboard)/mailboxes/[mailbox_slug]/(inbox)/_components/toolItem";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToolExecution } from "@/hooks/useToolExecution";
import type { RouterOutputs } from "@/trpc";

type Tool = RouterOutputs["mailbox"]["conversations"]["tools"]["list"]["all"][number];

type ToolFormProps = {
  tool: Tool;
  onOpenChange: (open: boolean) => void;
};

export const ToolForm = ({ tool, onOpenChange }: ToolFormProps) => {
  const [parameters, setParameters] = useState<Record<string, string | number>>({});
  const [invalidFields, setInvalidFields] = useState<string[]>([]);

  const { isExecuting, handleToolExecution } = useToolExecution();

  const updateParameters = (name: string, value: string | number) => {
    setParameters((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleExecute = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const invalidFields = tool.parameterTypes
      .filter((param) => param.required && parameters[param.name] === undefined)
      .map((param) => param.name);
    if (invalidFields.length > 0) {
      setInvalidFields(invalidFields);
      return;
    }

    const success = await handleToolExecution(tool.slug, tool.name, parameters);
    if (success) {
      onOpenChange(false);
    }
  };

  return (
    <form className="space-y-4 p-4 overflow-y-auto" onSubmit={handleExecute}>
      <div>
        <h3 className="font-medium">{tool.name}</h3>
        {tool.description && <p className="text-xs text-muted-foreground">{tool.description}</p>}
      </div>
      {tool.parameterTypes.map(({ name, description, type, required }) => (
        <div key={name} className="grid gap-1">
          <Label htmlFor={name} className="text-sm">
            {formatParameter(name)}
            {required ? "" : " (optional)"}
          </Label>
          <Input
            id={name}
            value={parameters[name] ?? ""}
            onChange={(e) => {
              updateParameters(name, type === "number" ? Number(e.target.value) : e.target.value);
              setInvalidFields(invalidFields.filter((field) => field !== name));
            }}
            className={invalidFields.includes(name) ? "border-destructive" : ""}
            hint={description ? <span className="text-xs">{description}</span> : null}
          />
        </div>
      ))}
      <Button variant="default" type="submit" disabled={isExecuting}>
        {isExecuting ? "Running..." : "Run Tool"}
      </Button>
    </form>
  );
};
