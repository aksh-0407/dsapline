/**
 * lib/streaks.ts
 *
 * Single source of truth for streak math. Previously the dashboard
 * (lib/analytics.ts) and the ETL migration (app/api/migrate/route.ts) each
 * had their own copy of this logic, and the leaderboard's stored
 * User.currentStreak/maxStreak columns were only ever written by the
 * migration — so they froze after launch. This module consolidates the
 * calculation and exposes a recompute-on-write helper so the stored columns
 * stay accurate.
 */
import { Prisma } from "@prisma/client";
import { toISTDateString, todayIST, yesterdayIST } from "./date";

/**
 * Compute current and max streaks from a list of activity dates.
 *
 * @param dates - YYYY-MM-DD strings (IST). Order and duplicates don't matter.
 *
 * Rules:
 *  - currentStreak: consecutive days counting back from today/yesterday (IST).
 *    If the most recent active day is neither today nor yesterday, it's 0.
 *  - maxStreak: the longest consecutive run ever.
 *  - Same-day duplicates collapse to one.
 */
export function calculateStreaks(dates: string[]): {
  currentStreak: number;
  maxStreak: number;
} {
  if (dates.length === 0) return { currentStreak: 0, maxStreak: 0 };

  // Unique, ascending. Parse at noon UTC so DST/offset never shifts the day.
  const uniqueDates = Array.from(new Set(dates)).sort();

  // --- Max streak (forward pass) ---
  let maxStreak = 1;
  let runStreak = 1;
  for (let i = 1; i < uniqueDates.length; i++) {
    const prev = new Date(uniqueDates[i - 1] + "T12:00:00Z");
    const curr = new Date(uniqueDates[i] + "T12:00:00Z");
    const diffDays = Math.round((curr.getTime() - prev.getTime()) / 86400000);

    if (diffDays === 1) {
      runStreak++;
      if (runStreak > maxStreak) maxStreak = runStreak;
    } else {
      runStreak = 1;
    }
  }

  // --- Current streak (walk backwards from today/yesterday) ---
  let currentStreak = 0;
  const today = todayIST();
  const yesterday = yesterdayIST();

  const sortedDesc = [...uniqueDates].sort((a, b) => b.localeCompare(a));
  const mostRecent = sortedDesc[0];

  if (mostRecent === today || mostRecent === yesterday) {
    const checkDate = new Date(mostRecent + "T12:00:00Z");
    for (const dateStr of sortedDesc) {
      const expected = toISTDateString(checkDate);
      if (dateStr === expected) {
        currentStreak++;
        checkDate.setDate(checkDate.getDate() - 1);
      } else {
        break;
      }
    }
  }

  return { currentStreak, maxStreak };
}

/**
 * Recompute and persist User.currentStreak / User.maxStreak from the user's
 * submission history. Call inside the same transaction as a write so the
 * leaderboard's stored columns stay in sync with reality.
 *
 * Accepts either the base client or a transaction client.
 */
export async function recomputeUserStreaks(
  client: Prisma.TransactionClient,
  userId: string
): Promise<void> {
  const subs = await client.submission.findMany({
    where: { userId },
    select: { createdAt: true },
  });

  const dates = subs.map((s) => toISTDateString(s.createdAt));
  const { currentStreak, maxStreak } = calculateStreaks(dates);

  await client.user.update({
    where: { id: userId },
    data: { currentStreak, maxStreak },
  });
}
