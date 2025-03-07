import { TRPCError } from "@trpc/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import { tools } from "@/db/schema/tools";
import { captureExceptionAndLogIfDevelopment } from "@/lib/shared/sentry";
import { callToolApi, generateAvailableTools, ToolApiError } from "@/lib/tools/apiTool";
import { conversationProcedure } from "./procedure";

export const toolsRouter = {
  list: conversationProcedure.query(async ({ ctx }) => {
    const { conversation, mailbox } = ctx;

    const mailboxTools = await db.query.tools.findMany({
      where: and(eq(tools.mailboxId, mailbox.id), eq(tools.enabled, true)),
    });

    if (mailboxTools.length === 0) {
      return { recommended: [], all: [] };
    }

    try {
      const toolsAvailable = await generateAvailableTools(conversation, mailbox, mailboxTools);
      return {
        recommended: toolsAvailable,
        all: mailboxTools.map((tool) => ({
          name: tool.name,
          slug: tool.slug,
          description: tool.description,
          parameterTypes: tool.parameters ?? [],
        })),
      };
    } catch (error) {
      captureExceptionAndLogIfDevelopment(error);
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Error listing available tools",
      });
    }
  }),

  run: conversationProcedure
    .input(
      z.object({
        tool: z.string(),
        params: z.record(z.any()),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { tool: toolSlug, params } = input;
      const conversation = ctx.conversation;

      const tool = await db.query.tools.findFirst({
        where: and(eq(tools.slug, toolSlug), eq(tools.mailboxId, conversation.mailboxId), eq(tools.enabled, true)),
      });

      if (!tool) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      try {
        return await callToolApi(conversation, tool, params);
      } catch (error) {
        if (error instanceof ToolApiError) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: error.message,
          });
        }

        captureExceptionAndLogIfDevelopment(error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Error executing tool",
        });
      }
    }),
};
