import { BoltIcon, ChevronDownIcon, ChevronRightIcon, ExclamationTriangleIcon } from "@heroicons/react/24/outline";
import { kebabCase, upperFirst } from "lodash";
import { useState } from "react";
import type { Message } from "@/app/types/global";
import HumanizedTime from "@/components/humanizedTime";
import { ToolMetadata } from "@/db/schema/conversationMessages";

export const formatParameter = (name: string) => upperFirst(kebabCase(name).replaceAll("-", " "));

export const ToolItem = ({
  message,
  initialExpanded,
}: {
  message: Message & { metadata: ToolMetadata };
  initialExpanded: boolean;
}) => {
  const [detailsExpanded, setDetailsExpanded] = useState(initialExpanded);
  const tool = message.metadata.tool;
  const parameters = message.metadata.parameters;
  const isSuccess = message.metadata.success;
  const apiResult = message.metadata.result;
  const Icon = isSuccess ? BoltIcon : ExclamationTriangleIcon;

  return (
    <div className="flex flex-col mx-auto max-w-full">
      <button
        className="flex items-center justify-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        onClick={() => setDetailsExpanded(!detailsExpanded)}
      >
        {detailsExpanded ? <ChevronDownIcon className="h-3 w-3" /> : <ChevronRightIcon className="h-3 w-3" />}
        <Icon className="h-4 w-4" />
        <span className="flex items-center gap-1">
          {tool.name}
          {isSuccess ? "" : " failed"}
        </span>
        <span>·</span>
        <span>
          <HumanizedTime time={message.createdAt} />
        </span>
      </button>

      {detailsExpanded && (
        <div className="mt-2 text-sm text-muted-foreground border rounded p-4 overflow-x-auto">
          <div className="flex flex-col gap-2">
            {!isSuccess && (
              <>
                <div>
                  <div>
                    <strong>Request</strong>
                  </div>
                  <div className="font-mono">
                    {tool.requestMethod} {tool.url}
                  </div>
                </div>
              </>
            )}
            <div>
              <div>
                <strong>Parameters</strong>
              </div>
              <div className="font-mono">
                <JsonView data={parameters} />
              </div>
            </div>
            <div>
              <div>
                <strong>Result</strong>
              </div>
              <div className="font-mono">
                <JsonView data={apiResult} />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const JsonView = ({ data, level = 0 }: { data: any; level?: number }) => {
  const indent = level * 2;

  if (Array.isArray(data)) {
    if (data.length === 0) return <span>(empty)</span>;

    return (
      <div>
        <div style={{ marginLeft: `${indent}ch` }}>
          {data.map((item, index) => (
            <div key={index}>
              <JsonView data={item} level={level + 1} />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (typeof data === "object") {
    const entries = Object.entries(data);

    if (entries.length === 0) return <span>(empty)</span>;

    return (
      <div>
        <div style={{ marginLeft: `${indent}ch` }}>
          {entries.map(([key, value]) => (
            <div key={key}>
              <span>{key}: </span>
              <JsonView data={value} level={level + 1} />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return <span className="text-foreground">{String(data)}</span>;
};
