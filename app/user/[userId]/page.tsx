import { getDashboardData } from "@/lib/analytics";
import { getUserArchive } from "@/lib/archive";
import Archive from "@/components/Archive";
import { LinkIcon, User } from "lucide-react";

interface Props {
  params: Promise<{ userId: string }>;
}

export const dynamic = "force-dynamic";

export default async function UserProfile({ params }: Props) {
  const { userId } = await params;

  // 1. Reuse our robust analytics engine to get all stats (Streaks, Counts, History)
  // This calculates Current/Highest streak using the same logic as the dashboard.
  const stats = await getDashboardData(userId);

  if (stats.totalSolved === 0) {
    return (
      <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center">
        <div className="text-center space-y-4">
          <User size={48} className="mx-auto text-gray-600" />
          <h1 className="text-2xl font-bold text-gray-400">User not found</h1>
          <p className="text-gray-500">ID: {userId}</p>
          <p className="text-sm text-gray-600">This Whizz hasn&apos;t submitted any problems yet.</p>
        </div>
      </div>
    );
  }

  // Extract username from the most recent activity
  const username = stats.recentActivity[0]?.username || "Whizz";

  return (
    <main className="min-h-screen bg-gray-950 text-white p-6 md:p-12">
      <div className="max-w-7xl mx-auto space-y-12">
        
        {/* PROFILE HEADER */}
        <div className="bg-gradient-to-br from-gray-900 to-black border border-gray-800 rounded-2xl p-8 md:p-12 text-center md:text-left shadow-2xl">
          <div className="flex flex-col md:flex-row items-center gap-8">
            
            {/* Avatar */}
            <div className="w-24 h-24 bg-gray-800 rounded-full flex items-center justify-center border-4 border-gray-700 shadow-xl">
              <span className="text-3xl font-bold text-gray-400">
                {username.charAt(0).toUpperCase()}
              </span>
            </div>

            {/* User Identity */}
            <div className="space-y-2 flex-1">
              <h1 className="text-4xl font-bold text-white capitalize">{username}</h1>
              <p className="text-gray-600 font-mono text-xs">{userId}</p>
            </div>

            {/* NEW STATS GRID: Problems | Days | Cur Streak | Max Streak */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center border-t md:border-t-0 border-gray-800 pt-6 md:pt-0 w-full md:w-auto">
              
              <div>
                <div className="text-3xl font-bold text-blue-400">{stats.totalSolved}</div>
                <div className="text-xs text-gray-500 uppercase tracking-wider mt-1">Problems</div>
              </div>
              
              <div>
                <div className="text-3xl font-bold text-purple-400">{stats.uniqueDays}</div>
                <div className="text-xs text-gray-500 uppercase tracking-wider mt-1">Days Active</div>
              </div>
              
              <div>
                <div className="text-3xl font-bold text-orange-400">{stats.currentStreak}</div>
                <div className="text-xs text-gray-500 uppercase tracking-wider mt-1">Current Streak</div>
              </div>

              <div>
                <div className="text-3xl font-bold text-yellow-400">{stats.highestStreak}</div>
                <div className="text-xs text-gray-500 uppercase tracking-wider mt-1">Highest Streak</div>
              </div>

            </div>

          </div>
        </div>

        {/* Problem History */}
        <div className="space-y-6">
          <div className="flex items-center gap-3 border-b border-gray-800 pb-4">
            <LinkIcon size={24} className="text-blue-500" />
            <h2 className="text-2xl font-bold text-white">Problem History</h2>
          </div>
          
          <ArchiveWrapper userId={userId} />
        </div>

      </div>
    </main>
  );
}

async function ArchiveWrapper({ userId }: { userId: string }) {
  const userData = await getUserArchive(userId);
  return <Archive data={userData} currentUserId={null} />;
}