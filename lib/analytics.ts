import { getGlobalArchive } from "@/lib/archive";
import { IndexEntry } from "@/lib/types";

export interface DashboardStats {
  totalSolved: number;
  uniqueDays: number;
  currentStreak: number;
  highestStreak: number; // Matches UI component expectation
  recentActivity: IndexEntry[];
  activityMap: Record<string, number>;
}

export async function getDashboardData(userId: string): Promise<DashboardStats> {
  // 1. Fetch Data
  const allSubmissions = await getGlobalArchive();
  
  // 2. Filter for Current User (Secure)
  const userSubs = allSubmissions.filter((s) => s.userId === userId);
  
  // 3. Generate Activity Map (DateString -> Count)
  // We use "YYYY-MM-DD" directly to ensure timezone stability
  const activityMap: Record<string, number> = {};
  
  userSubs.forEach((sub) => {
    let dateStr = sub.date;
    // Fallback if strict date field is missing
    if (!dateStr && sub.timestamp) {
       dateStr = new Date(sub.timestamp).toISOString().split("T")[0];
    }
    
    if (dateStr) {
      activityMap[dateStr] = (activityMap[dateStr] || 0) + 1;
    }
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
        // Set to Noon (12:00) to safely cross DST/Timezone boundaries
        thisDate.setHours(12, 0, 0, 0); 

        const prevDate = i > 0 ? new Date(sortedDates[i-1]) : null;
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
    // Logic: Start from Today. If no activity Today, check Yesterday. 
    // If activity found in either, count backwards until the chain breaks.
    let checkDate = new Date(); // Starts as Today
    const todayStr = checkDate.toISOString().split("T")[0];
    
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yestStr = yesterday.toISOString().split("T")[0];

    let streakIsAlive = false;

    if (activityMap[todayStr]) {
        // Solved today: Streak is alive, start counting from today
        streakIsAlive = true;
    } else if (activityMap[yestStr]) {
        // Solved yesterday: Streak is alive, start counting from yesterday
        checkDate = yesterday;
        streakIsAlive = true;
    } 
    // Else: streakIsAlive remains false, currentStreak remains 0

    if (streakIsAlive) {
        while (true) {
            const dateStr = checkDate.toISOString().split("T")[0];
            if (activityMap[dateStr]) {
                currentStreak++;
                checkDate.setDate(checkDate.getDate() - 1); // Go back one day
            } else {
                break; // Gap found, stop counting
            }
        }
    }
  }

  // 5. Prepare Recent Activity (Sorted Newest First)
  const recentActivity = [...userSubs]
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, 5);

  return {
    totalSolved: userSubs.length,
    uniqueDays: sortedDates.length,
    currentStreak,
    highestStreak,
    recentActivity,
    activityMap
  };
}