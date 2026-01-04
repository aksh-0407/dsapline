"use client";

import { useState } from "react";
import Link from "next/link";
import { Trophy, Medal, Flame, Zap } from "lucide-react";

interface LeaderboardEntry {
  userId: string;
  username: string;
  totalSolved: number;
  highestStreak: number;
  lastActive: string;
  favoritePlatform: string;
}

interface Props {
  data: LeaderboardEntry[];
  currentUserId: string | null;
}

export function LeaderboardClient({ data, currentUserId }: Props) {
  const [sortMode, setSortMode] = useState<"solved" | "streak">("solved");

  // Sort Data based on selection
  const sortedData = [...data].sort((a, b) => {
    if (sortMode === "solved") {
      return b.totalSolved - a.totalSolved || b.highestStreak - a.highestStreak;
    } else {
      return b.highestStreak - a.highestStreak || b.totalSolved - a.totalSolved;
    }
  });

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden shadow-2xl">
      
      {/* TABS HEADER */}
      <div className="flex border-b border-gray-800">
        <button
          onClick={() => setSortMode("solved")}
          className={`flex-1 py-4 text-sm font-bold uppercase tracking-wider transition-colors flex items-center justify-center gap-2 ${
            sortMode === "solved" ? "bg-gray-800 text-white" : "text-gray-500 hover:text-gray-300"
          }`}
        >
          <Trophy size={16} className={sortMode === "solved" ? "text-yellow-400" : ""} />
          Most Solved
        </button>
        <div className="w-[1px] bg-gray-800"></div>
        <button
          onClick={() => setSortMode("streak")}
          className={`flex-1 py-4 text-sm font-bold uppercase tracking-wider transition-colors flex items-center justify-center gap-2 ${
            sortMode === "streak" ? "bg-gray-800 text-white" : "text-gray-500 hover:text-gray-300"
          }`}
        >
          <Flame size={16} className={sortMode === "streak" ? "text-orange-500" : ""} />
          Highest Streak
        </button>
      </div>

      {/* LIST */}
      {sortedData.length > 0 ? (
        <div className="divide-y divide-gray-800">
          {sortedData.map((entry, index) => {
            const rank = index + 1;
            const isMe = entry.userId === currentUserId;

            // Rank Icons
            let RankIcon = <span className="text-xl font-bold text-gray-500 w-6 text-center">{rank}</span>;
            if (rank === 1) RankIcon = <Trophy className="text-yellow-400" size={24} />;
            if (rank === 2) RankIcon = <Medal className="text-gray-300" size={24} />;
            if (rank === 3) RankIcon = <Medal className="text-amber-700" size={24} />;

            return (
              <div 
                key={entry.userId} 
                className={`p-6 flex items-center gap-4 md:gap-6 transition-colors ${
                  isMe ? "bg-blue-900/10 hover:bg-blue-900/20" : "hover:bg-gray-800/50"
                }`}
              >
                {/* Rank */}
                <div className="flex-shrink-0 w-8 md:w-12 flex justify-center">{RankIcon}</div>

                {/* User Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 md:gap-3">
                    <Link 
                      href={`/user/${entry.userId}`} 
                      className={`text-base md:text-lg font-bold truncate hover:underline ${
                        isMe ? "text-blue-400" : "text-white"
                      }`}
                    >
                      {entry.username} {isMe && "(You)"}
                    </Link>
                  </div>
                  <div className="text-xs md:text-sm text-gray-500 flex items-center gap-2 mt-1">
                    <span className="capitalize hidden md:inline">{entry.favoritePlatform} Specialist</span>
                    <span className="hidden md:inline">•</span>
                    <span>Last active {entry.lastActive}</span>
                  </div>
                </div>

                {/* Metrics */}
                <div className="flex gap-6 text-right">
                  {/* Solved Count */}
                  <div className={`${sortMode === "solved" ? "opacity-100" : "opacity-50"}`}>
                    <div className="text-xl md:text-2xl font-bold text-white">{entry.totalSolved}</div>
                    <div className="text-[10px] md:text-xs text-gray-500 uppercase">Solved</div>
                  </div>

                  {/* Streak Count */}
                  <div className={`${sortMode === "streak" ? "opacity-100" : "opacity-50"}`}>
                    <div className="text-xl md:text-2xl font-bold text-orange-400 flex items-center justify-end gap-1">
                      {entry.highestStreak} <Zap size={14} className="fill-orange-400" />
                    </div>
                    <div className="text-[10px] md:text-xs text-gray-500 uppercase">Streak</div>
                  </div>
                </div>

              </div>
            );
          })}
        </div>
      ) : (
        <div className="p-12 text-center text-gray-500">
          <Trophy size={48} className="mx-auto text-gray-700 mb-4" />
          <p>No Whizzes have entered the arena yet.</p>
        </div>
      )}
    </div>
  );
}