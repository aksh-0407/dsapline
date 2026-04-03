import prisma from "./prisma";
import { IndexEntry } from "./types";
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
  // 1. Fetch all submissions for this user from SQL
  const submissions = await prisma.submission.findMany({
    where: { userId },
    include: { problem: true, user: true },
    orderBy: { createdAt: "desc" },
  });

  // 2. Generate Activity Map (DateString -> Count)
  const activityMap: Record<string, number> = {};

  submissions.forEach((sub) => {
    const dateStr = toISTDateString(sub.createdAt);
    activityMap[dateStr] = (activityMap[dateStr] || 0) + 1;
  });

  // 3. Calculate Streaks
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

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yestStr = yesterdayIST();

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

  // 4. Prepare Recent Activity (top 5, mapped to IndexEntry shape)
  const recentActivity: IndexEntry[] = submissions.slice(0, 5).map((sub) => ({
    id: sub.id,
    title: sub.problem.title,
    difficulty: sub.problem.difficultyValue ?? 5, // community avg for display
    difficultyRating: sub.difficultyRating,        // user's own rating
    tags: sub.tags,
    username: sub.user.fullName ?? sub.userId,
    userId: sub.userId,
    date: toISTDateString(sub.createdAt),
    timestamp: sub.createdAt.toISOString(),
    platform: sub.problem.platform as IndexEntry["platform"],
    difficultyLabel: sub.problem.difficultyLabel ?? undefined,
    rating: sub.problem.rating ?? undefined,
  }));


  return {
    totalSolved: submissions.length,
    uniqueDays: sortedDates.length,
    currentStreak,
    highestStreak,
    recentActivity,
    activityMap,
  };
}