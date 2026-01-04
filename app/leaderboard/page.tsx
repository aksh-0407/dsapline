export const dynamic = "force-dynamic";

import { auth } from "@clerk/nextjs/server";
import { getGlobalArchive } from "@/lib/archive";
import { LeaderboardClient } from "@/components/LeaderboardClient"; 

// Helper to calc streak for arbitrary dates
function calculateStreak(dates: string[]): number {
  if (dates.length === 0) return 0;
  const uniqueSorted = Array.from(new Set(dates)).sort();
  let maxStreak = 0;
  let current = 0;
  
  for (let i = 0; i < uniqueSorted.length; i++) {
    const thisDate = new Date(uniqueSorted[i]);
    thisDate.setHours(12,0,0,0); // Avoid timezone issues
    
    if (i === 0) {
      current = 1;
    } else {
      const prevDate = new Date(uniqueSorted[i-1]);
      prevDate.setHours(12,0,0,0);
      const diff = (thisDate.getTime() - prevDate.getTime()) / (1000*60*60*24);
      if (Math.round(diff) === 1) current++;
      else current = 1;
    }
    if (current > maxStreak) maxStreak = current;
  }
  return maxStreak;
}

export default async function LeaderboardPage() {
  const { userId: currentUserId } = await auth();
  const allSubmissions = await getGlobalArchive();

  // 1. Group Submissions by UserID
  const userMap = new Map<string, typeof allSubmissions>();
  allSubmissions.forEach(sub => {
    const existing = userMap.get(sub.userId) || [];
    existing.push(sub);
    userMap.set(sub.userId, existing);
  });

  // 2. Calculate Stats for each User
  const leaderboardData = Array.from(userMap.entries()).map(([userId, subs]) => {
    // Sort Newest First to get latest username/activity
    const sortedSubs = subs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    
    // Calculate Streak
    const dates = subs.map(s => s.date).filter(Boolean);
    const highestStreak = calculateStreak(dates);

    // Find favorite platform (Internal logic for potential icons)
    const platforms = subs.map(s => s.platform || "other");
    const favPlatform = platforms.sort((a,b) =>
          platforms.filter(v => v===a).length - platforms.filter(v => v===b).length
    ).pop() || "General";

    return {
      userId,
      username: sortedSubs[0].username,
      totalSolved: subs.length,
      highestStreak: highestStreak,
      lastActive: sortedSubs[0].date,
      favoritePlatform: favPlatform
    };
  });

  // 3. Default Sort on Server (Solved Descending)
  leaderboardData.sort((a, b) => b.totalSolved - a.totalSolved);

  return (
    <main className="min-h-screen bg-gray-950 text-white p-6 md:p-12">
      <div className="max-w-5xl mx-auto space-y-8">
        
        {/* Header */}
        <div className="text-center space-y-4 mb-8">
          <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
            Leaderboard
          </h1>
          {/* Subtitle Removed per instructions */}
        </div>

        {/* Client Component with Sorting Tabs */}
        <LeaderboardClient data={leaderboardData} currentUserId={currentUserId} />

      </div>
    </main>
  );
}