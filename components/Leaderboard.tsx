"use client";

import { useState } from "react";
import { LeaderboardEntry } from "@/lib/leaderboard";
import { Trophy, Flame, Calendar, User } from "lucide-react";

interface Props {
  initialData: LeaderboardEntry[];
  currentUserId: string | null;
}

export default function Leaderboard({ initialData, currentUserId }: Props) {
  const [filter, setFilter] = useState<"solved" | "streak">("solved");

  // Sort Data based on selection
  const sortedData = [...initialData].sort((a, b) => {
    if (filter === "solved") {
      return b.totalSolved - a.totalSolved;
    } else {
      return b.currentStreak - a.currentStreak;
    }
  });

  return (
    <div className="space-y-6">
      {/* Toggle Controls */}
      <div className="flex justify-center gap-4">
        <button
          onClick={() => setFilter("solved")}
          className={`flex items-center gap-2 px-6 py-3 rounded-full font-bold transition-all ${
            filter === "solved"
              ? "bg-blue-600 text-white shadow-lg shadow-blue-900/50 scale-105"
              : "bg-gray-800 text-gray-400 hover:bg-gray-700"
          }`}
        >
          <Trophy size={20} />
          Most Solved
        </button>
        <button
          onClick={() => setFilter("streak")}
          className={`flex items-center gap-2 px-6 py-3 rounded-full font-bold transition-all ${
            filter === "streak"
              ? "bg-orange-600 text-white shadow-lg shadow-orange-900/50 scale-105"
              : "bg-gray-800 text-gray-400 hover:bg-gray-700"
          }`}
        >
          <Flame size={20} />
          Highest Streak
        </button>
      </div>

      {/* The Table */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-gray-950 text-gray-400 uppercase text-xs font-bold">
            <tr>
              <th className="px-6 py-4 w-20 text-center">Rank</th>
              <th className="px-6 py-4">Warrior</th>
              <th className="px-6 py-4 text-center">Total Solved</th>
              <th className="px-6 py-4 text-center">Current Streak</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800">
            {sortedData.map((user, index) => {
              const isMe = user.userId === currentUserId;
              
              // Rank styling
              let rankIcon = <span className="text-gray-500 font-mono">#{index + 1}</span>;
              if (index === 0) rankIcon = <span className="text-2xl">🥇</span>;
              if (index === 1) rankIcon = <span className="text-2xl">🥈</span>;
              if (index === 2) rankIcon = <span className="text-2xl">🥉</span>;

              return (
                <tr 
                  key={user.userId} 
                  className={`transition-colors ${isMe ? "bg-blue-900/20" : "hover:bg-gray-800/50"}`}
                >
                  <td className="px-6 py-4 text-center font-bold">{rankIcon}</td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="bg-gray-800 p-2 rounded-full">
                        <User size={16} className="text-gray-400" />
                      </div>
                      <div className="flex flex-col">
                        <span className={`font-semibold ${isMe ? "text-blue-400" : "text-white"}`}>
                          {user.username} {isMe && "(You)"}
                        </span>
                        <span className="text-xs text-gray-500">
                           Last Active: {user.lastActive || "N/A"}
                        </span>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className="inline-flex items-center gap-1 font-mono text-lg font-bold text-blue-400">
                      {user.totalSolved}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className={`inline-flex items-center gap-1 font-mono text-lg font-bold 
                      ${user.currentStreak > 0 ? "text-orange-400" : "text-gray-600"}`}>
                      {user.currentStreak} <Flame size={14} />
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {sortedData.length === 0 && (
          <div className="p-12 text-center text-gray-500">
            No warriors found in the arena yet.
          </div>
        )}
      </div>
    </div>
  );
}