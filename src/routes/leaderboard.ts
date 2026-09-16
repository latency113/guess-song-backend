import { Elysia, t } from "elysia";
import { db } from "../db";

export const leaderboardRoutes = new Elysia({ prefix: "/api/leaderboard" })
  .get(
    "/",
    async ({ query }) => {
      const category = query?.category as string | undefined;
      const mode = query?.mode as string | undefined;
      const limit = query?.limit ? parseInt(query.limit as string, 10) : 25;

      const records = await db.getLeaderboard(category, limit, mode);

      return {
        category: category || "ALL",
        mode: mode || "ALL",
        count: records.length,
        leaderboard: records.map((r, index) => ({
          rank: index + 1,
          id: r.id,
          userId: r.userId,
          displayName: r.displayName || r.guestName || "Player",
          username: r.username,
          category: r.category,
          mode: r.mode || "disguised",
          score: r.score,
          correctCount: r.correctCount,
          totalRounds: r.totalRounds,
          timeTakenSec: r.timeTakenSec,
          createdAt: r.createdAt
        }))
      };
    },
    {
      query: t.Optional(
        t.Object({
          category: t.Optional(t.String()),
          mode: t.Optional(t.String()),
          limit: t.Optional(t.String())
        })
      )
    }
  )
  .get("/stats", async () => {
    const stats = await db.getGlobalStats();
    return {
      ...stats
    };
  });
