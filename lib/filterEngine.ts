import { IndexEntry } from "./types";

export interface FilterState {
  // 1. General
  search: string; // Matches Title or Username
  platform: string; // "all", "leetcode", "codeforces"...
  dateRange: { start: string; end: string }; // ISO Date Strings
  
  // 2. Metrics
  difficultyRange: { min: number; max: number }; // 0-10
  tags: string[]; // Must match ANY of these (OR logic)

  // 3. LeetCode Specific
  lcDifficulty: string[]; // ["Easy", "Medium"]

  // 4. Codeforces Specific
  cfRatingRange: { min: number; max: number }; // 0 - 3500
  cfContestRange: { min: number; max: number }; // 0 - 9999
  cfIndex: string; // "A", "B", "C"...
}

export const INITIAL_FILTERS: FilterState = {
  search: "",
  platform: "all",
  dateRange: { start: "", end: "" },
  difficultyRange: { min: 0, max: 10 },
  tags: [],
  lcDifficulty: [],
  cfRatingRange: { min: 0, max: 3500 },
  cfContestRange: { min: 0, max: 9999 },
  cfIndex: "",
};

/**
 * filterSubmissions has been removed — the Archive component uses its own
 * local filterArchiveEntries() which operates on ArchiveEntry[].
 * This file now only exports the FilterState type and INITIAL_FILTERS constant.
 */