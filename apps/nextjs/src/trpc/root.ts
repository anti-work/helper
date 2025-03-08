import { userRouter } from "@/trpc/router/user";
import { gmailSupportEmailRouter } from "./router/gmailSupportEmail";
import { mailboxRouter } from "./router/mailbox";
import { organizationRouter } from "./router/organization";
import { subscriptionRouter } from "./router/subscription";
import { createTRPCRouter, publicProcedure } from "./trpc";

export const appRouter = createTRPCRouter({
  mailbox: mailboxRouter,
  organization: organizationRouter,
  user: userRouter,
  gmailSupportEmail: gmailSupportEmailRouter,
  subscription: subscriptionRouter,
  isSignedIn: publicProcedure.query(({ ctx }) => !!ctx.session?.userId),
  testing: publicProcedure.query(async ({ ctx }) => {
    console.log(ctx);
    await new Promise((resolve) => setTimeout(resolve, 1000));
    return [
      {
        id: 1,
        name: "Item 1",
        createdAt: new Date(),
        isActive: true,
        tags: ["tag1", "tag2"],
      },
      {
        id: 2,
        name: "Item 2",
        createdAt: new Date(2023, 0, 1),
        isActive: false,
        tags: [],
      },
      {
        id: 3,
        name: "Item 3",
        createdAt: new Date(2022, 11, 31, 23, 59, 59),
        isActive: true,
        tags: ["special"],
      },
      {
        id: 4,
        name: "Nested Item",
        createdAt: new Date(),
        isActive: true,
        nested: {
          value: BigInt(9007199254740991),
          map: new Map([
            ["key1", "value1"],
            ["key2", "value2"],
          ]),
          set: new Set([1, 2, 3, 4, 5]),
        },
      },
    ];
  }),
});

// export type definition of API
export type AppRouter = typeof appRouter;
