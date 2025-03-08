import { TRPCRouterRecord } from "@trpc/server";
import { z } from "zod";
import { DataError } from "@/lib/data/dataError";
import {
  createMailboxMetadataApi,
  deleteMailboxMetadataApiByMailboxSlug,
  testMailboxMetadataApiURL,
} from "@/lib/data/mailboxMetadataApi";
import { mailboxProcedure } from "./procedure";

export const metadataEndpointRouter = {
  create: mailboxProcedure
    .input(
      z.object({
        mailboxSlug: z.string().optional(),
        url: z.string().url(),
      }),
    )
    .mutation(async ({ ctx, input: { url } }) => {
      try {
        await createMailboxMetadataApi(ctx.mailbox.slug, { url });
        return { success: true, error: undefined };
      } catch (e) {
        return { success: false, error: e instanceof DataError ? e.message : "Error adding metadata endpoint" };
      }
    }),
  delete: mailboxProcedure.input(z.object({ mailboxSlug: z.string().optional() })).mutation(async ({ ctx }) => {
    try {
      await deleteMailboxMetadataApiByMailboxSlug(ctx.mailbox.slug);
      return { success: true, error: undefined };
    } catch (e) {
      return { success: false, error: e instanceof DataError ? e.message : "Error deleting metadata endpoint" };
    }
  }),
  test: mailboxProcedure.input(z.object({ mailboxSlug: z.string().optional() })).query(async ({ ctx }) => {
    try {
      await testMailboxMetadataApiURL(ctx.mailbox.slug);
      return { success: true, error: undefined };
    } catch (e) {
      return { success: false, error: e instanceof DataError ? e.message : "Error testing metadata endpoint" };
    }
  }),
} satisfies TRPCRouterRecord;
