import { router, publicProcedure } from "./trpc";
import { z } from "zod";
import { db, palettes, users } from "@hue-und-you/db";
import { eq } from "drizzle-orm";

export const appRouter = router({
  palette: router({
    create: publicProcedure
      .input(
        z.object({
          userId: z.number(),
          name: z.string(),
          colors: z.array(
            z.object({
              hex: z.string(),
              rgb: z.tuple([z.number(), z.number(), z.number()]),
              hsl: z.tuple([z.number(), z.number(), z.number()]),
              name: z.string().optional(),
            }),
          ),
          imageUrl: z.string().optional(),
        }),
      )
      .mutation(async ({ input }) => {
        const result = await db
          .insert(palettes)
          .values({
            userId: input.userId,
            name: input.name,
            colors: input.colors,
            imageUrl: input.imageUrl,
          })
          .returning();
        return result[0];
      }),

    getById: publicProcedure.input(z.number()).query(async ({ input }) => {
      const result = await db.query.palettes.findFirst({
        where: eq(palettes.id, input),
      });
      return result;
    }),

    listByUser: publicProcedure.input(z.number()).query(async ({ input }) => {
      const result = await db.query.palettes.findMany({
        where: eq(palettes.userId, input),
      });
      return result;
    }),
  }),
});

export type AppRouter = typeof appRouter;
