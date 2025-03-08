import { TRPCError, TRPCRouterRecord } from "@trpc/server";
import { and, count, eq } from "drizzle-orm";
import { z } from "zod";
import { MAX_STYLE_LINTERS } from "@/components/constants";
import { takeUniqueOrThrow } from "@/components/utils/arrays";
import { db } from "@/db/client";
import { styleLinters } from "@/db/schema";
import { resetMailboxPromptUpdatedAt } from "@/lib/data/mailbox";
import { setPrivateMetadata } from "@/lib/data/organization";
import { mailboxProcedure } from "./procedure";

export const styleLintersRouter = {
  list: mailboxProcedure.query(async ({ ctx }) => {
    return await db
      .select({
        id: styleLinters.id,
        before: styleLinters.before,
        after: styleLinters.after,
      })
      .from(styleLinters)
      .where(eq(styleLinters.clerkOrganizationId, ctx.mailbox.clerkOrganizationId));
  }),
  upsert: mailboxProcedure
    .input(
      z.object({
        mailboxSlug: z.string().optional(),
        linter: z.object({
          id: z.number().optional(),
          before: z.string(),
          after: z.string(),
        }),
      }),
    )
    .mutation(async ({ ctx, input: { linter } }) => {
      await db.transaction(async (tx) => {
        if (linter.id) {
          await tx
            .update(styleLinters)
            .set({
              before: linter.before,
              after: linter.after,
            })
            .where(
              and(
                eq(styleLinters.id, linter.id),
                eq(styleLinters.clerkOrganizationId, ctx.mailbox.clerkOrganizationId),
              ),
            )
            .returning();
        } else {
          const { count: existingLinterCount } = await tx
            .select({ count: count(styleLinters.id) })
            .from(styleLinters)
            .where(eq(styleLinters.clerkOrganizationId, ctx.mailbox.clerkOrganizationId))
            .then(takeUniqueOrThrow);
          if (existingLinterCount >= MAX_STYLE_LINTERS) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: `You can only have a maximum of ${MAX_STYLE_LINTERS} style linters.`,
            });
          }
          await tx.insert(styleLinters).values({
            clerkOrganizationId: ctx.mailbox.clerkOrganizationId,
            before: linter.before,
            after: linter.after,
          });
        }

        await resetMailboxPromptUpdatedAt(tx, ctx.mailbox.id);
      });

      return { success: true };
    }),
  delete: mailboxProcedure
    .input(
      z.object({
        id: z.number(),
      }),
    )
    .mutation(async ({ ctx, input: { id } }) => {
      await db.transaction(async (tx) => {
        await tx
          .delete(styleLinters)
          .where(and(eq(styleLinters.id, id), eq(styleLinters.clerkOrganizationId, ctx.mailbox.clerkOrganizationId)));

        await resetMailboxPromptUpdatedAt(tx, ctx.mailbox.id);
      });

      return { success: true };
    }),
  setEnabled: mailboxProcedure
    .input(
      z.object({
        enabled: z.boolean(),
      }),
    )
    .mutation(async ({ input: { enabled }, ctx }) => {
      await setPrivateMetadata(ctx.mailbox.clerkOrganizationId, { isStyleLinterEnabled: enabled });
      await db.transaction((tx) => resetMailboxPromptUpdatedAt(tx, ctx.mailbox.id));
    }),
} satisfies TRPCRouterRecord;
