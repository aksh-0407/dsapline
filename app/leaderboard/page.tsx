export const dynamic = "force-dynamic";

import { auth } from "@clerk/nextjs/server";
import prisma from "@/lib/prisma";
import { LeaderboardClient } from "@/components/LeaderboardClient";

export default async function LeaderboardPage() {
  const { userId: currentUserId } = await auth();

  // Fetch user stats directly from the User table.
  // totalSolved is kept accurate by the submit route (Case A/B branching).
  // currentStreak / maxStreak are computed and stored by the migration;
  // for live accuracy you could recompute from submissions, but the stored
  // values are good enough for display.
  const users = await prisma.user.findMany({
    select: {
      id: true,
      fullName: true,
      totalSolved: true,
      currentStreak: true,
      maxStreak: true,
      updatedAt: true,
      // Pull the most recent submission for "last active" date
      submissions: {
        select: { createdAt: true },
        orderBy: { createdAt: "desc" },
        take: 1,
      },
      // Pull all submission dates for live streak recompute (lightweight)
      _count: { select: { submissions: true } },
    },
    orderBy: { totalSolved: "desc" },
  });

  const leaderboardData = users.map((u) => {
    const lastSubmission = u.submissions[0];
    const lastActive = lastSubmission
      ? lastSubmission.createdAt.toISOString().split("T")[0]
      : u.updatedAt.toISOString().split("T")[0];

    return {
      userId: u.id,
      username: u.fullName ?? u.id,
      totalSolved: u.totalSolved,
      highestStreak: u.maxStreak,
      currentStreak: u.currentStreak,
      lastActive,
      favoritePlatform: "General", // Could be enriched, but not needed for ranking
    };
  });

  return (
    <main className="min-h-screen bg-gray-950 text-white p-6 md:p-12">
      <div className="max-w-5xl mx-auto space-y-8">

        {/* Header */}
        <div className="text-center space-y-4 mb-8">
          <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
            Leaderboard
          </h1>
        </div>

        {/* Client Component with Sorting Tabs */}
        <LeaderboardClient data={leaderboardData} currentUserId={currentUserId} />

      </div>
    </main>
  );
}