import prisma from "./prisma";
import { unstable_cache } from "next/cache";
import { IndexEntry } from "./types";
import { mapSubmissionToIndexEntry } from "./archive";
import { toISTDateString, todayIST, yesterdayIST } from "./date";

export interface DashboardStats {
  totalSolved: number;
  uniqueDays: number;
  currentStreak: number;
  highestStreak: number;
  recentActivity: IndexEntry[];
  activityMap: Record<string, number>;
}

export async function getDashboardData(userId: string): Promise<DashboardStats> {
  return unstable_cache(
    async (id: string) => {
      // 1. totalSolved = unique SolvedProblem rows for this user
      //    This is the canonical count — does NOT inflate for alternates/re-submits.
  const totalSolved = await prisma.solvedProblem.count({ where: { userId } });

  // 2. All submission timestamps for heatmap + streaks
  //    ANY submission event (main, alternate, re-submission) marks that day active.
  const allSubs = await prisma.submission.findMany({
    where: { userId },
    select: { createdAt: true },
    orderBy: { createdAt: "desc" },
  });

  // 3. Generate Activity Map (DateString → Count)
  const activityMap: Record<string, number> = {};
  allSubs.forEach((sub) => {
    const dateStr = toISTDateString(sub.createdAt);
    activityMap[dateStr] = (activityMap[dateStr] || 0) + 1;
  });

  // 4. Calculate Streaks
  const sortedDates = Object.keys(activityMap).sort();

  let currentStreak = 0;
  let highestStreak = 0;
  let tempStreak = 0;

  if (sortedDates.length > 0) {
    // --- A. Highest Streak Calculation (Forward Pass) ---
    for (let i = 0; i < sortedDates.length; i++) {
      const thisDate = new Date(sortedDates[i]);
      thisDate.setHours(12, 0, 0, 0);

      const prevDate = i > 0 ? new Date(sortedDates[i - 1]) : null;
      if (prevDate) prevDate.setHours(12, 0, 0, 0);

      if (prevDate) {
        const diffTime = Math.abs(thisDate.getTime() - prevDate.getTime());
        const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
        if (diffDays === 1) {
          tempStreak++;
        } else {
          tempStreak = 1;
        }
      } else {
        tempStreak = 1;
      }
      if (tempStreak > highestStreak) highestStreak = tempStreak;
    }

    // --- B. Current Streak Calculation (Backward Check) ---
    let checkDate = new Date();
    const todayStr = todayIST();
    const yestStr = yesterdayIST();

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    let streakIsAlive = false;
    if (activityMap[todayStr]) {
      streakIsAlive = true;
    } else if (activityMap[yestStr]) {
      checkDate = yesterday;
      streakIsAlive = true;
    }

    if (streakIsAlive) {
      while (true) {
        const dateStr = toISTDateString(checkDate);
        if (activityMap[dateStr]) {
          currentStreak++;
          checkDate.setDate(checkDate.getDate() - 1);
        } else {
          break;
        }
      }
    }
  }

  // 5. Recent Activity — last 5 Submission events (any type)
  //    Shows what the user has actually been coding recently.
  const recentRaw = await prisma.submission.findMany({
    where: { userId },
    include: { problem: true, user: true },
    orderBy: { createdAt: "desc" },
    take: 5,
  });

  const recentActivity: IndexEntry[] = recentRaw.map(mapSubmissionToIndexEntry);

    return {
      totalSolved,
      uniqueDays: sortedDates.length,
      currentStreak,
      highestStreak,
      recentActivity,
      activityMap,
    };
  },
  [`dashboard-${userId}`],
  { tags: [`dashboard-${userId}`], revalidate: 86400 } // Cache for 24 hours, manually revalidated on submit
  )(userId);
}