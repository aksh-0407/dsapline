import { DashboardStats } from "@/lib/analytics";
import { Trophy, Flame, Calendar, Crown } from "lucide-react";

export function StatsGrid({ stats }: { stats: DashboardStats }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
      
      {/* 1. Total Solved */}
      <div className="bg-gray-900 border border-gray-800 p-6 rounded-xl flex items-center gap-4">
        <div className="p-3 bg-blue-900/30 rounded-lg text-blue-400">
          <Trophy size={24} />
        </div>
        <div>
          <p className="text-gray-400 text-xs uppercase font-bold tracking-wider">Total Solved</p>
          <h3 className="text-3xl font-bold text-white">{stats.totalSolved}</h3>
        </div>
      </div>

      {/* 2. Current Streak */}
      <div className="bg-gray-900 border border-gray-800 p-6 rounded-xl flex items-center gap-4">
        <div className="p-3 bg-orange-900/30 rounded-lg text-orange-400">
          <Flame size={24} />
        </div>
        <div>
          <p className="text-gray-400 text-xs uppercase font-bold tracking-wider">Current Streak</p>
          <h3 className="text-3xl font-bold text-white">{stats.currentStreak} <span className="text-sm text-gray-500 font-normal">days</span></h3>
        </div>
      </div>

      {/* 3. Highest Streak (REPLACED) */}
      <div className="bg-gray-900 border border-gray-800 p-6 rounded-xl flex items-center gap-4">
        <div className="p-3 bg-yellow-900/30 rounded-lg text-yellow-400">
          <Crown size={24} />
        </div>
        <div>
          <p className="text-gray-400 text-xs uppercase font-bold tracking-wider">Highest Streak</p>
          <h3 className="text-3xl font-bold text-white">{stats.highestStreak} <span className="text-sm text-gray-500 font-normal">days</span></h3>
        </div>
      </div>

      {/* 4. Active Days */}
      <div className="bg-gray-900 border border-gray-800 p-6 rounded-xl flex items-center gap-4">
        <div className="p-3 bg-emerald-900/30 rounded-lg text-emerald-400">
          <Calendar size={24} />
        </div>
        <div>
          <p className="text-gray-400 text-xs uppercase font-bold tracking-wider">Active Days</p>
          <h3 className="text-3xl font-bold text-white">{stats.uniqueDays}</h3>
        </div>
      </div>

    </div>
  );
}