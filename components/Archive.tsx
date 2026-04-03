"use client";

import { useState, useMemo } from "react";
import { IndexEntry } from "@/lib/types";
import { ArchiveFilters } from "./ArchiveFilters"; 
import { INITIAL_FILTERS, filterSubmissions } from "@/lib/filterEngine";
import { Code2, Calendar, User, Filter } from "lucide-react";
import Link from "next/link";

interface Props {
  data: IndexEntry[];
  currentUserId: string | null;
}

export default function Archive({ data, currentUserId }: Props) {
  const [filters, setFilters] = useState(INITIAL_FILTERS);

  // 1. Get Unique Tags from Data (for the filter dropdown)
  const availableTags = useMemo(() => {
    const set = new Set<string>();
    data.forEach(item => item.tags.forEach(t => set.add(t)));
    return Array.from(set).sort();
  }, [data]);

  // 2. Filter Data
  const filteredData = useMemo(() => {
    return filterSubmissions(data, filters);
  }, [data, filters]);

  return (
    <div className="space-y-6">
      
      {/* FILTER CONTROL PANEL */}
      <ArchiveFilters 
        filters={filters} 
        setFilters={setFilters} 
        availableTags={availableTags} 
      />

      {/* RESULTS TABLE */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden shadow-2xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-gray-950 text-gray-400 uppercase text-xs font-bold">
              <tr>
                <th className="px-6 py-4">User</th>
                <th className="px-6 py-4">Problem</th>
                <th className="px-6 py-4">Platform</th>
                <th className="px-6 py-4">Difficulty</th>
                <th className="px-6 py-4">Date</th>
                <th className="px-6 py-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {filteredData.map((item) => {
                const isMe = item.userId === currentUserId;
                return (
                  <tr key={item.id} className={`transition-colors group ${isMe ? "bg-blue-900/10 hover:bg-blue-900/20" : "hover:bg-gray-800/50"}`}>
                    
                    {/* User */}
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <div className={`p-1.5 rounded-full ${isMe ? "bg-blue-900 text-blue-400" : "bg-gray-800 text-gray-400"}`}>
                          <User size={14} />
                        </div>
                        
                        {/* CHANGED: Link now points to /user/[userId] instead of [username] */}
                        <Link 
                          href={`/user/${item.userId}`} 
                          className={`text-sm font-medium hover:underline ${isMe ? "text-blue-400" : "text-gray-300"}`}
                        >
                          {item.username} {isMe && "(You)"}
                        </Link>
                      </div>
                    </td>

                    {/* Title & Tags */}
                    <td className="px-6 py-4 max-w-xs">
                      {item.problemSlug ? (
                        <Link href={`/problem/${item.problemSlug}`} className="font-semibold text-white truncate block hover:text-blue-400 transition-colors" title={item.title}>
                          {item.title}
                        </Link>
                      ) : (
                        <div className="font-semibold text-white truncate" title={item.title}>{item.title}</div>
                      )}
                      
                      {/* Sub-info: Contest ID for Codeforces */}
                      {item.contestId && (
                        <div className="text-[10px] text-gray-500 font-mono mt-0.5">
                          Contest {item.contestId} {item.problemIndex}
                        </div>
                      )}

                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {item.tags.slice(0, 3).map((tag) => (
                          <span key={tag} className="text-[10px] bg-gray-800 text-gray-400 px-2 py-0.5 rounded-full border border-gray-700">
                            {tag}
                          </span>
                        ))}
                        {item.tags.length > 3 && (
                          <span className="text-[10px] text-gray-500 px-1">+{item.tags.length - 3}</span>
                        )}
                      </div>
                    </td>

                    {/* Platform Badge */}
                    <td className="px-6 py-4">
                      <span className={`capitalize px-2 py-1 rounded text-xs font-bold border
                        ${item.platform === 'leetcode' ? 'bg-yellow-900/20 text-yellow-500 border-yellow-900/50' : 
                          item.platform === 'codeforces' ? 'bg-red-900/20 text-red-500 border-red-900/50' : 
                          'bg-blue-900/20 text-blue-500 border-blue-900/50'}`}>
                        {item.platform}
                      </span>
                    </td>

                    {/* Rich Difficulty Display */}
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        {/* 1. The 0-10 Scale (Always present) */}
                        <span className={`font-mono font-bold text-sm
                           ${item.difficulty >= 8 ? "text-red-400" : 
                             item.difficulty >= 5 ? "text-yellow-400" : 
                             "text-green-400"}`}>
                          {item.difficulty > 0 ? item.difficulty.toFixed(1) : "-"}
                        </span>
                        
                        {/* 2. The Specific Label (Easy/Hard or Rating) */}
                        {item.difficultyLabel && (
                          <span className="text-[10px] uppercase font-bold text-gray-500 tracking-wider">
                            {item.difficultyLabel}
                          </span>
                        )}
                        {item.rating && (
                          <span className="text-[10px] font-mono text-red-400">
                            Rating: {item.rating}
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Date */}
                    <td className="px-6 py-4 text-gray-400 text-sm whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <Calendar size={14} />
                        {item.date}
                      </div>
                    </td>

                    {/* Actions */}
                    <td className="px-6 py-4 text-right">
                       <Link 
                         href={`/submission/${item.id}`} 
                         className="text-gray-500 hover:text-white transition-colors inline-block p-2 rounded-full hover:bg-gray-800"
                         title="View Code"
                       >
                         <Code2 size={18} />
                       </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Empty State */}
        {filteredData.length === 0 && (
          <div className="p-16 text-center text-gray-500 flex flex-col items-center gap-4">
            <div className="bg-gray-800 p-4 rounded-full">
              <Filter size={32} className="opacity-50" />
            </div>
            <div>
              <p className="text-lg font-medium text-gray-300">No problems found</p>
              <p className="text-sm">Try adjusting your filters or search terms.</p>
            </div>
            <button 
              onClick={() => setFilters(INITIAL_FILTERS)}
              className="mt-2 text-blue-400 hover:text-blue-300 text-sm font-semibold"
            >
              Clear all filters
            </button>
          </div>
        )}
      </div>

      <div className="text-center text-xs text-gray-600">
        Showing {filteredData.length} of {data.length} total problems
      </div>
    </div>
  );
}