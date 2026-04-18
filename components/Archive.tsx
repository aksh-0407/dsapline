"use client";

import { useState, useMemo, useEffect } from "react";
import { ArchiveEntry } from "@/lib/types";
import { ArchiveFilters } from "./ArchiveFilters";
import { INITIAL_FILTERS } from "@/lib/filterEngine";
import { Code2, Calendar, User, Filter, ChevronDown, ChevronUp, Layers } from "lucide-react";
import Link from "next/link";

// ---------------------------------------------------------------------------
// filterArchiveEntries — operates on ArchiveEntry[] (SolvedProblem rows)
// ---------------------------------------------------------------------------
function filterArchiveEntries(entries: ArchiveEntry[], filters: typeof INITIAL_FILTERS): ArchiveEntry[] {
  let result = [...entries];

  if (filters.search) {
    const q = filters.search.toLowerCase();
    result = result.filter(
      (e) =>
        e.title.toLowerCase().includes(q) ||
        e.username.toLowerCase().includes(q) ||
        e.tags.some((t) => t.toLowerCase().includes(q))
    );
  }

  if (filters.platform && filters.platform !== "all") {
    result = result.filter((e) => e.platform === filters.platform);
  }

  // tags is an array — OR logic: entry must match at least one selected tag
  if (filters.tags.length > 0) {
    result = result.filter((e) =>
      e.tags.some((t) => filters.tags.includes(t))
    );
  }

  // Date range filter (uses firstSolvedAt in YYYY-MM-DD)
  if (filters.dateRange.start) {
    result = result.filter((e) => e.date >= filters.dateRange.start);
  }
  if (filters.dateRange.end) {
    result = result.filter((e) => e.date <= filters.dateRange.end);
  }

  // Difficulty range filter — skip entries where difficulty is null (unrated)
  // so unrated problems pass through all difficulty filters instead of being
  // incorrectly excluded or matched at a phantom value.
  result = result.filter((e) => {
    if (e.difficulty === null) return true; // unrated: always pass through
    return e.difficulty >= filters.difficultyRange.min && e.difficulty <= filters.difficultyRange.max;
  });

  // LeetCode difficulty label filter
  if (filters.lcDifficulty.length > 0) {
    result = result.filter((e) =>
      !e.difficultyLabel || filters.lcDifficulty.includes(e.difficultyLabel)
    );
  }

  // Codeforces rating range
  result = result.filter((e) => {
    if (!e.rating) return true; // non-CF problems pass through
    return e.rating >= filters.cfRatingRange.min && e.rating <= filters.cfRatingRange.max;
  });

  // Codeforces problem index
  if (filters.cfIndex && filters.cfIndex.trim()) {
    result = result.filter((e) =>
      !e.problemIndex ||
      e.problemIndex.toLowerCase() === filters.cfIndex.toLowerCase()
    );
  }

  return result;
}

// ---------------------------------------------------------------------------
// Main Archive component
// ---------------------------------------------------------------------------

interface Props {
  data: ArchiveEntry[];
  currentUserId: string | null;
}

export default function Archive({ data, currentUserId }: Props) {
  const [filters, setFilters] = useState(INITIAL_FILTERS);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  // 1. Get Unique Tags from Data (for the filter dropdown)
  const availableTags = useMemo(() => {
    const set = new Set<string>();
    data.forEach((item) => item.tags.forEach((t) => set.add(t)));
    return Array.from(set).sort();
  }, [data]);

  // 2. Filter Data
  const filteredData = useMemo(() => {
    return filterArchiveEntries(data, filters);
  }, [data, filters]);

  const toggleExpanded = (id: string) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

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
                <th className="px-6 py-4">Last Active</th>
                <th className="px-6 py-4">Solutions</th>
                <th className="px-6 py-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {filteredData.map((item) => {
                const isMe = item.userId === currentUserId;
                const isExpanded = expandedRows.has(item.id);
                const hasMultipleSolutions = item.submissionCount > 1;

                return (
                  // C1 fix: key must be on the actual DOM element, not on the fragment.
                  // Using a fragment with a wrapping key-bearing element here.
                  <ArchiveRow
                    key={item.id}
                    item={item}
                    isMe={isMe}
                    isExpanded={isExpanded}
                    hasMultipleSolutions={hasMultipleSolutions}
                    onToggleExpanded={toggleExpanded}
                  />
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

// ---------------------------------------------------------------------------
// ArchiveRow — extracted to own component so React keys work on real elements
// C1 fix: key is on the <tr> now, not a fragment
// ---------------------------------------------------------------------------
interface ArchiveRowProps {
  item: ArchiveEntry;
  isMe: boolean;
  isExpanded: boolean;
  hasMultipleSolutions: boolean;
  onToggleExpanded: (id: string) => void;
}

function ArchiveRow({ item, isMe, isExpanded, hasMultipleSolutions, onToggleExpanded }: ArchiveRowProps) {
  return (
    <>
      <tr
        className={`transition-colors group ${
          isMe ? "bg-blue-900/10 hover:bg-blue-900/20" : "hover:bg-gray-800/50"
        }`}
      >
        {/* User */}
        <td className="px-6 py-4 whitespace-nowrap">
          <div className="flex items-center gap-2">
            <div
              className={`p-1.5 rounded-full ${
                isMe ? "bg-blue-900 text-blue-400" : "bg-gray-800 text-gray-400"
              }`}
            >
              <User size={14} />
            </div>
            <Link
              href={`/user/${item.userId}`}
              className={`text-sm font-medium hover:underline ${
                isMe ? "text-blue-400" : "text-gray-300"
              }`}
            >
              {item.username} {isMe && "(You)"}
            </Link>
          </div>
        </td>

        {/* Title & Tags */}
        <td className="px-6 py-4 max-w-xs">
          <Link
            href={`/problem/${item.problemSlug}`}
            className="font-semibold text-white truncate block hover:text-blue-400 transition-colors"
            title={item.title}
          >
            {item.title}
          </Link>

          <div className="flex flex-wrap gap-1 mt-1.5">
            {item.tags.slice(0, 3).map((tag) => (
              <span
                key={tag}
                className="text-[10px] bg-gray-800 text-gray-400 px-2 py-0.5 rounded-full border border-gray-700"
              >
                {tag}
              </span>
            ))}
            {item.tags.length > 3 && (
              <span className="text-[10px] text-gray-500 px-1">
                +{item.tags.length - 3}
              </span>
            )}
          </div>
        </td>

        {/* Platform Badge */}
        <td className="px-6 py-4">
          <span
            className={`capitalize px-2 py-1 rounded text-xs font-bold border ${
              item.platform === "leetcode"
                ? "bg-yellow-900/20 text-yellow-500 border-yellow-900/50"
                : item.platform === "codeforces"
                ? "bg-red-900/20 text-red-500 border-red-900/50"
                : "bg-blue-900/20 text-blue-500 border-blue-900/50"
            }`}
          >
            {item.platform}
          </span>
        </td>

        {/* Rich Difficulty Display — null means unrated */}
        <td className="px-6 py-4">
          <div className="flex flex-col">
            <span
              className={`font-mono font-bold text-sm ${
                item.difficulty === null
                  ? "text-gray-600"
                  : item.difficulty >= 8
                  ? "text-red-400"
                  : item.difficulty >= 5
                  ? "text-yellow-400"
                  : "text-green-400"
              }`}
            >
              {item.difficulty === null ? "—" : item.difficulty.toFixed(1)}
            </span>
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

        {/* Solutions count */}
        <td className="px-6 py-4">
          {hasMultipleSolutions ? (
            <button
              onClick={() => onToggleExpanded(item.id)}
              className="flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300 transition-colors font-medium"
            >
              <Layers size={13} />
              {item.submissionCount} solutions
              {isExpanded ? (
                <ChevronUp size={12} />
              ) : (
                <ChevronDown size={12} />
              )}
            </button>
          ) : (
            // P3 fix: was text-gray-600 (near-invisible); bumped to text-gray-400
            <span className="text-xs text-gray-400">1 solution</span>
          )}
        </td>

        {/* Actions */}
        <td className="px-6 py-4 text-right">
          {item.mainSubmissionId && (
            <Link
              href={`/submission/${item.mainSubmissionId}`}
              className="text-gray-500 hover:text-white transition-colors inline-block p-2 rounded-full hover:bg-gray-800"
              title="View Main Solution"
            >
              <Code2 size={18} />
            </Link>
          )}
        </td>
      </tr>

      {/* Expandable row: list of solutions */}
      {isExpanded && hasMultipleSolutions && (
        <tr className="bg-gray-950/80">
          <td colSpan={7} className="px-8 py-3">
            <SolutionsExpanded solvedProblemId={item.id} />
          </td>
        </tr>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Expandable solutions panel
// C2 fix: fetch moved to useEffect (was in render body — side-effect violation)
// ---------------------------------------------------------------------------

interface SolutionItem {
  id: string;
  title: string | null;
  language: string;
  isMainSolution: boolean;
  createdAt: string;
  notes: string | null;
}

function SolutionsExpanded({ solvedProblemId }: { solvedProblemId: string }) {
  const [solutions, setSolutions] = useState<SolutionItem[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  // C2 fix: fetch in useEffect, not in render body
  useEffect(() => {
    let cancelled = false;

    fetch(`/api/solutions?solvedProblemId=${solvedProblemId}`)
      .then((r) => r.json())
      .then((d) => {
        if (!cancelled) setSolutions(d.data || []);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [solvedProblemId]);

  if (loading) {
    return <p className="text-xs text-gray-500 py-1">Loading solutions…</p>;
  }
  if (error || !solutions) {
    return <p className="text-xs text-red-500 py-1">Failed to load solutions.</p>;
  }

  return (
    <div className="flex flex-col gap-2">
      {solutions.map((s) => (
        <div
          key={s.id}
          className="flex items-center justify-between text-sm py-1.5 px-3 rounded-lg bg-gray-900 border border-gray-800"
        >
          <div className="flex items-center gap-3">
            <span
              className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${
                s.isMainSolution
                  ? "bg-emerald-900/40 text-emerald-400 border border-emerald-800"
                  : "bg-gray-800 text-gray-500 border border-gray-700"
              }`}
            >
              {s.isMainSolution ? "Main" : "Alt"}
            </span>
            <span className="text-gray-300 font-medium">
              {s.title || (s.isMainSolution ? "Main Solution" : "Alternate Solution")}
            </span>
            <span className="text-gray-600 text-xs font-mono">{s.language}</span>
          </div>
          <Link
            href={`/submission/${s.id}`}
            className="text-gray-500 hover:text-blue-400 transition-colors flex items-center gap-1 text-xs"
          >
            <Code2 size={13} /> View
          </Link>
        </div>
      ))}
    </div>
  );
}