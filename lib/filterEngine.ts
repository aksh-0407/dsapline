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

export function filterSubmissions(data: IndexEntry[], filters: FilterState): IndexEntry[] {
  return data.filter((item) => {
    // 1. SEARCH (Title or Username)
    if (filters.search) {
      const q = filters.search.toLowerCase();
      const matchesTitle = item.title.toLowerCase().includes(q);
      const matchesUser = item.username.toLowerCase().includes(q);
      if (!matchesTitle && !matchesUser) return false;
    }

    // 2. PLATFORM
    if (filters.platform !== "all" && item.platform !== filters.platform) {
      return false;
    }

    // 3. DATE RANGE
    if (filters.dateRange.start && item.date < filters.dateRange.start) return false;
    if (filters.dateRange.end && item.date > filters.dateRange.end) return false;

    // 4. DIFFICULTY (Internal 0-10)
    if (item.difficulty < filters.difficultyRange.min || item.difficulty > filters.difficultyRange.max) {
      return false;
    }

    // 5. TAGS (If selected, item must have at least one)
    if (filters.tags.length > 0) {
      const hasTag = item.tags.some(t => filters.tags.includes(t));
      if (!hasTag) return false;
    }

    // --- LEETCODE SPECIFIC ---
    if (filters.lcDifficulty.length > 0) {
      // Only filter if it's a LeetCode problem OR if it has a label
      if (item.difficultyLabel && !filters.lcDifficulty.includes(item.difficultyLabel)) {
        return false;
      }
    }

    // --- CODEFORCES SPECIFIC ---
    // A. Rating
    if (item.rating) {
      if (item.rating < filters.cfRatingRange.min || item.rating > filters.cfRatingRange.max) return false;
    }
    
    // B. Contest ID
    if (item.contestId) {
      const cId = parseInt(item.contestId);
      if (!isNaN(cId)) {
        if (cId < filters.cfContestRange.min || cId > filters.cfContestRange.max) return false;
      }
    }

    // C. Problem Index (e.g., "A")
    if (filters.cfIndex && item.problemIndex) {
      if (item.problemIndex.toLowerCase() !== filters.cfIndex.toLowerCase()) return false;
    }

    return true;
  });
}