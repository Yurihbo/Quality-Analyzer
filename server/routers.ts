import { z } from "zod";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
import { analyzeWebsite, validatePublicUrl } from "./analyzer";
import { TRPCError } from "@trpc/server";

const recentRequests = new Map<string, number[]>();
const WINDOW_MS = 60_000;
const MAX_REQUESTS_PER_WINDOW = 6;

function checkRateLimit(key: string) {
  const now = Date.now();
  const recent = (recentRequests.get(key) || []).filter((time) => now - time < WINDOW_MS);
  if (recent.length >= MAX_REQUESTS_PER_WINDOW) return false;
  recent.push(now);
  recentRequests.set(key, recent);
  if (recentRequests.size > 5000) {
    recentRequests.forEach((times, entry) => {
      if (!times.some((time: number) => now - time < WINDOW_MS)) recentRequests.delete(entry);
    });
  }
  return true;
}

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),
  analyzer: router({
    analyze: publicProcedure
      .input(z.object({ url: z.string().trim().min(3).max(2048) }))
      .mutation(async ({ input, ctx }) => {
        const requester = String(ctx.req.headers["x-forwarded-for"] || ctx.req.ip || "anonymous").split(",")[0].trim();
        if (!checkRateLimit(requester)) {
          throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: "Too many analyses. Please wait a minute and try again." });
        }
        let url: string;
        try {
          url = validatePublicUrl(input.url);
        } catch (error) {
          throw new TRPCError({ code: "BAD_REQUEST", message: error instanceof Error ? error.message : "Enter a valid public website URL." });
        }
        try {
          return await analyzeWebsite(url);
        } catch (error) {
          const message = error instanceof Error ? error.message : "Unable to analyze this website.";
          throw new TRPCError({ code: "BAD_REQUEST", message });
        }
      }),
  }),
});

export type AppRouter = typeof appRouter;
