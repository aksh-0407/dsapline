import { getFile } from "./github";
import { IndexEntry } from "./types";

export interface LeaderboardEntry {
  userId: string;
  username: string;
  totalSolved: number;
  currentStreak: number;
  lastActive: string; // ISO Date
}

// Helper: Calculate Streak from a list of dates
function calculateStreak(dates: string[]): number {
  if (dates.length === 0) return 0;

  // 1. Deduplicate & Sort Dates (Newest to Oldest)
  const uniqueDates = Array.from(new Set(dates)).sort((a, b) => 
    new Date(b).getTime() - new Date(a).getTime()
  );

  const today = new Date().toISOString().split('T')[0];
  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];

  // 2. Check if streak is alive (Must have solved Today or Yesterday)
  const mostRecent = uniqueDates[0];
  if (mostRecent !== today && mostRecent !== yesterday) {
    return 0; // Streak broken
  }

  // 3. Count backwards
  let streak = 0;
  let checkDate = new Date(mostRecent);

  for (const dateStr of uniqueDates) {
    // Expected date string
    const checkStr = checkDate.toISOString().split('T')[0];
    
    if (dateStr === checkStr) {
      streak++;
      // Move checkDate back 1 day
      checkDate.setDate(checkDate.getDate() - 1);
    } else {
      // Gap found, streak ends
      break;
    }
  }

  return streak;
}

export async function getLeaderboard(): Promise<LeaderboardEntry[]> {
  const file = await getFile("data/index.json");
  
  if (!file.exists || !file.content) {
    return [];
  }

  const allSubmissions: IndexEntry[] = Array.isArray(file.content) ? file.content : [];

  // 1. Group by User ID
  const userMap = new Map<string, { username: string; dates: string[] }>();

  allSubmissions.forEach((sub) => {
    if (!sub.userId) return; // Skip legacy data without ID

    if (!userMap.has(sub.userId)) {
      userMap.set(sub.userId, { username: sub.username, dates: [] });
    }
    
    const userData = userMap.get(sub.userId)!;
    userData.dates.push(sub.date);
    
    // Update username to the most recent one found (in case they changed it)
    // Since we iterate from top (newest) to bottom, the first one we see is usually newest
    // But index isn't guaranteed sorted, so we just use the current one.
  });

  // 2. Compute Stats for each User
  const leaderboard: LeaderboardEntry[] = [];

  userMap.forEach((data, userId) => {
    leaderboard.push({
      userId,
      username: data.username,
      totalSolved: data.dates.length,
      currentStreak: calculateStreak(data.dates),
      lastActive: data.dates.sort().pop() || "", // Last date in the list
    });
  });

  // 3. Default Sort: Total Solved (Highest First)
  return leaderboard.sort((a, b) => b.totalSolved - a.totalSolved);
}