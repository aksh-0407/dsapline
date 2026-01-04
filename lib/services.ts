// lib/services.ts

// Define the shape of our "Enriched" data
export interface ProblemMetadata {
  realTitle?: string;       // The official name
  difficultyLabel?: string; // "Easy" | "Medium" | "Hard"
  rating?: number;          // Codeforces Rating
  tags?: string[];          // Official tags
  contestId?: string;
  problemIndex?: string;
}

/**
 * 1. LEETCODE FETCHER (via GraphQL)
 */
async function fetchLeetCodeData(slug: string): Promise<ProblemMetadata | null> {
  try {
    const response = await fetch("https://leetcode.com/graphql", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "Mozilla/5.0 (compatible; DSA-Tracker/1.0)",
      },
      body: JSON.stringify({
        query: `
          query questionData($titleSlug: String!) {
            question(titleSlug: $titleSlug) {
              questionId
              title
              difficulty
              topicTags {
                name
              }
            }
          }
        `,
        variables: { titleSlug: slug },
      }),
    });

    const data = await response.json();
    const q = data?.data?.question;

    if (!q) return null;

    return {
      realTitle: `${q.questionId}. ${q.title}`, // Format: "1. Two Sum"
      difficultyLabel: q.difficulty, // "Easy", "Medium", "Hard"
      tags: q.topicTags.map((t: any) => t.name),
    };
  } catch (error) {
    console.error("LeetCode Fetch Error:", error);
    return null;
  }
}

/**
 * 2. CODEFORCES FETCHER (via API)
 */
async function fetchCodeforcesData(contestId: string, index: string): Promise<ProblemMetadata | null> {
  try {
    // We use contest.standings because it's lighter than fetching the whole problemset
    const url = `https://codeforces.com/api/contest.standings?contestId=${contestId}&from=1&count=1`;
    const response = await fetch(url);
    const data = await response.json();

    if (data.status !== "OK") return null;

    // Find the specific problem in the contest
    const problem = data.result.problems.find((p: any) => p.index === index);

    if (!problem) return null;

    return {
      realTitle: `${contestId}${index} - ${problem.name}`, // Format: "4A - Watermelon"
      rating: problem.rating,
      tags: problem.tags,
      contestId: contestId,
      problemIndex: index,
    };
  } catch (error) {
    console.error("Codeforces Fetch Error:", error);
    return null;
  }
}

/**
 * MAIN ENRICHMENT FUNCTION
 * Detects platform and calls the right fetcher
 */
export async function enrichProblemData(url: string): Promise<ProblemMetadata | null> {
  const lowerUrl = url.toLowerCase();

  // A. LEETCODE DETECTION
  if (lowerUrl.includes("leetcode.com/problems/")) {
    try {
      // URL format: .../problems/two-sum/description/...
      const parts = url.split("/problems/");
      if (parts.length > 1) {
        // Extract "two-sum" from the path
        const slug = parts[1].split("/")[0];
        return await fetchLeetCodeData(slug);
      }
    } catch {
      return null;
    }
  }

  // B. CODEFORCES DETECTION
  if (lowerUrl.includes("codeforces.com")) {
    try {
      // Supports two formats:
      // 1. /contest/4/problem/A
      // 2. /problemset/problem/4/A
      let contestId = "";
      let index = "";

      if (lowerUrl.includes("/contest/")) {
        const parts = url.split("/contest/");
        const subParts = parts[1].split("/problem/");
        contestId = subParts[0];
        index = subParts[1].replace("/", ""); // Remove trailing slash
      } else if (lowerUrl.includes("/problemset/problem/")) {
        const parts = url.split("/problemset/problem/");
        const subParts = parts[1].split("/");
        contestId = subParts[0];
        index = subParts[1];
      }

      if (contestId && index) {
        return await fetchCodeforcesData(contestId, index);
      }
    } catch {
      return null;
    }
  }

  return null;
}