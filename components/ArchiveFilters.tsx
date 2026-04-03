"use client";

import { FilterState } from "@/lib/filterEngine";
import { Search, Calendar, Tag, Filter, ChevronDown, ChevronUp } from "lucide-react";
import { useState } from "react";

interface Props {
  filters: FilterState;
  setFilters: (f: FilterState) => void;
  availableTags: string[]; // List of all unique tags in the current data
}

export function ArchiveFilters({ filters, setFilters, availableTags }: Props) {
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Helper to update specific fields
  const update = (key: keyof FilterState, value: FilterState[keyof FilterState]) => {
    setFilters({ ...filters, [key]: value });
  };

  const updateRange = (key: "difficultyRange" | "cfRatingRange" | "cfContestRange", type: "min" | "max", val: string) => {
    const num = val === "" ? 0 : parseFloat(val); // Handle empty as 0
    setFilters({
      ...filters,
      [key]: { ...filters[key], [type]: num }
    });
  };

  const toggleTag = (tag: string) => {
    const current = filters.tags;
    if (current.includes(tag)) update("tags", current.filter(t => t !== tag));
    else update("tags", [...current, tag]);
  };

  const toggleLcDiff = (label: string) => {
    const current = filters.lcDifficulty;
    if (current.includes(label)) update("lcDifficulty", current.filter(l => l !== label));
    else update("lcDifficulty", [...current, label]);
  };

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 space-y-4">
      
      {/* --- TOP ROW: SEARCH & PLATFORM --- */}
      <div className="flex flex-col md:flex-row gap-4">
        {/* Search */}
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-3 text-gray-500" size={20} />
          <input
            type="text"
            placeholder="Search Title, Username..."
            value={filters.search}
            onChange={(e) => update("search", e.target.value)}
            className="w-full bg-gray-950 border border-gray-800 rounded-lg pl-10 pr-4 py-2.5 text-white focus:ring-2 focus:ring-blue-600 outline-none"
          />
        </div>

        {/* Platform Select */}
        <select
          value={filters.platform}
          onChange={(e) => update("platform", e.target.value)}
          className="bg-gray-950 border border-gray-800 rounded-lg px-4 py-2.5 text-white focus:ring-2 focus:ring-blue-600 outline-none cursor-pointer"
        >
          <option value="all">All Platforms</option>
          <option value="leetcode">LeetCode</option>
          <option value="codeforces">Codeforces</option>
          <option value="hackerrank">HackerRank</option>
          <option value="geeksforgeeks">GeeksForGeeks</option>
          <option value="other">Other</option>
        </select>

        {/* Advanced Toggle */}
        <button
          onClick={() => setShowAdvanced(!showAdvanced)}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-lg border transition-colors ${
            showAdvanced ? "bg-blue-900/30 border-blue-600 text-blue-400" : "bg-gray-950 border-gray-800 text-gray-400 hover:text-white"
          }`}
        >
          <Filter size={18} /> Filters
          {showAdvanced ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>
      </div>

      {/* --- ADVANCED PANEL --- */}
      {showAdvanced && (
        <div className="pt-4 border-t border-gray-800 space-y-6 animate-in slide-in-from-top-2">
          
          {/* 1. GENERAL METRICS */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            
            {/* Date Range */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-gray-500 uppercase flex items-center gap-1"><Calendar size={12}/> Date Range</label>
              <div className="flex gap-2">
                <input type="date" className="w-full bg-gray-950 border border-gray-800 rounded px-2 py-1 text-sm text-gray-300" 
                  value={filters.dateRange.start} onChange={e => update("dateRange", { ...filters.dateRange, start: e.target.value })} />
                <input type="date" className="w-full bg-gray-950 border border-gray-800 rounded px-2 py-1 text-sm text-gray-300"
                  value={filters.dateRange.end} onChange={e => update("dateRange", { ...filters.dateRange, end: e.target.value })} />
              </div>
            </div>

            {/* Difficulty Range (0-10) */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-gray-500 uppercase">Difficulty (0-10)</label>
              <div className="flex items-center gap-2">
                <input type="number" min="0" max="10" placeholder="Min" className="w-full bg-gray-950 border border-gray-800 rounded px-3 py-1 text-sm text-gray-300"
                  value={filters.difficultyRange.min} onChange={e => updateRange("difficultyRange", "min", e.target.value)} />
                <span className="text-gray-600">-</span>
                <input type="number" min="0" max="10" placeholder="Max" className="w-full bg-gray-950 border border-gray-800 rounded px-3 py-1 text-sm text-gray-300"
                  value={filters.difficultyRange.max} onChange={e => updateRange("difficultyRange", "max", e.target.value)} />
              </div>
            </div>

            {/* Tags (Autocomplete style filter) */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-gray-500 uppercase flex items-center gap-1"><Tag size={12}/> Filter by Tags</label>
              <div className="flex flex-wrap gap-2 max-h-24 overflow-y-auto pr-2 custom-scrollbar">
                {availableTags.map(tag => (
                  <button
                    key={tag}
                    onClick={() => toggleTag(tag)}
                    className={`text-[10px] px-2 py-1 rounded-full border transition-colors ${
                      filters.tags.includes(tag) 
                        ? "bg-blue-600 border-blue-500 text-white" 
                        : "bg-gray-950 border-gray-800 text-gray-500 hover:border-gray-600"
                    }`}
                  >
                    {tag}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* 2. LEETCODE SPECIFIC */}
          {filters.platform !== 'codeforces' && (
             <div className="bg-yellow-900/10 p-4 rounded-lg border border-yellow-900/20">
               <h3 className="text-xs font-bold text-yellow-600 uppercase mb-3">LeetCode Specific</h3>
               <div className="flex gap-3">
                 {["Easy", "Medium", "Hard"].map(level => (
                   <button
                     key={level}
                     onClick={() => toggleLcDiff(level)}
                     className={`px-3 py-1 rounded text-xs font-bold transition-all border ${
                       filters.lcDifficulty.includes(level)
                         ? "bg-yellow-600 text-white border-yellow-500"
                         : "bg-gray-950 text-gray-400 border-gray-800 hover:border-yellow-800"
                     }`}
                   >
                     {level}
                   </button>
                 ))}
               </div>
             </div>
          )}

          {/* 3. CODEFORCES SPECIFIC */}
          {filters.platform !== 'leetcode' && (
            <div className="bg-red-900/10 p-4 rounded-lg border border-red-900/20 grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="md:col-span-3 text-xs font-bold text-red-600 uppercase">Codeforces Specific</div>
              
              {/* Rating Range */}
              <div className="space-y-1">
                <label className="text-[10px] text-red-400">Rating (800 - 3500)</label>
                <div className="flex gap-2">
                   <input type="number" placeholder="Min" className="w-full bg-gray-950 border border-gray-800 rounded px-2 py-1 text-sm"
                     onChange={e => updateRange("cfRatingRange", "min", e.target.value)} />
                   <input type="number" placeholder="Max" className="w-full bg-gray-950 border border-gray-800 rounded px-2 py-1 text-sm"
                     onChange={e => updateRange("cfRatingRange", "max", e.target.value)} />
                </div>
              </div>

              {/* Contest Range */}
              <div className="space-y-1">
                <label className="text-[10px] text-red-400">Contest ID</label>
                <div className="flex gap-2">
                   <input type="number" placeholder="Start" className="w-full bg-gray-950 border border-gray-800 rounded px-2 py-1 text-sm"
                     onChange={e => updateRange("cfContestRange", "min", e.target.value)} />
                   <input type="number" placeholder="End" className="w-full bg-gray-950 border border-gray-800 rounded px-2 py-1 text-sm"
                     onChange={e => updateRange("cfContestRange", "max", e.target.value)} />
                </div>
              </div>

              {/* Problem Index */}
              <div className="space-y-1">
                <label className="text-[10px] text-red-400">Problem (A, B...)</label>
                <input type="text" placeholder="e.g. C1" className="w-full bg-gray-950 border border-gray-800 rounded px-2 py-1 text-sm text-white uppercase"
                   value={filters.cfIndex} onChange={e => update("cfIndex", e.target.value.toUpperCase())} />
              </div>
            </div>
          )}

        </div>
      )}
    </div>
  );
}