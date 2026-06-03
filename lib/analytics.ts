import prisma from "./prisma";
import { unstable_cache } from "next/cache";
import { IndexEntry } from "./types";
import { mapSubmissionToIndexEntry } from "./archive";
import { toISTDateString } from "./date";
import { calculateStreaks } from "./streaks";
import { dashboardTag } from "./cache";

export interface DashboardStats {
  username: string;
  totalSolved: number;
  uniqueDays: number;
  currentStreak: number;
  highestStreak: number;
  recentActivity: IndexEntry[];
  activityMap: Record<string, number>;
}

export async function getDashboardData(userId: string): Promise<DashboardStats> {
  return unstable_cache(
    async (id: string): Promise<DashboardStats> => {
      // All four reads are independent — run them concurrently so the wall-clock
      // cost is one round-trip's worth, not four (matters most on Neon cold starts).
      const [totalSolved, allSubs, recentRaw, userRow] = await Promise.all([
        // totalSolved = unique SolvedProblem rows (does NOT inflate for alternates).
        prisma.solvedProblem.count({ where: { userId: id } }),
        // Every submission timestamp powers the heatmap + streaks.
        prisma.submission.findMany({
          where: { userId: id },
          select: { createdAt: true },
          orderBy: { createdAt: "desc" },
        }),
        // Last 5 submission events of any type for the recent-activity feed.
        prisma.submission.findMany({
          where: { userId: id },
          include: { problem: true, user: true },
          orderBy: { createdAt: "desc" },
          take: 5,
        }),
        prisma.user.findUnique({ where: { id }, select: { fullName: true, email: true } }),
      ]);

      // Activity map (IST date string → count).
      const activityMap: Record<string, number> = {};
      for (const sub of allSubs) {
        const dateStr = toISTDateString(sub.createdAt);
        activityMap[dateStr] = (activityMap[dateStr] || 0) + 1;
      }

      // Streaks (shared logic — see lib/streaks.ts).
      const dates = Object.keys(activityMap);
      const { currentStreak, maxStreak: highestStreak } = calculateStreaks(dates);

      const recentActivity: IndexEntry[] = recentRaw.map(mapSubmissionToIndexEntry);

      // Prefer the stored name; fall back to the email local-part; never a raw id.
      const username =
        userRow?.fullName?.trim() || userRow?.email?.split("@")[0] || id;

      return {
        username,
        totalSolved,
        uniqueDays: dates.length,
        currentStreak,
        highestStreak,
        recentActivity,
        activityMap,
      };
    },
    [dashboardTag(userId)],
    { tags: [dashboardTag(userId)], revalidate: 86400 } // 24h backstop; busted on every write
  )(userId);
}
