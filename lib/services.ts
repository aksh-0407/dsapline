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
      signal: AbortSignal.timeout(5000),
    });

    const data = await response.json();
    const q = data?.data?.question;

    if (!q) return null;

    return {
      realTitle: `${q.questionId}. ${q.title}`, // Format: "1. Two Sum"
      difficultyLabel: q.difficulty, // "Easy", "Medium", "Hard"
      tags: q.topicTags.map((t: { name: string }) => t.name),
    };
  } catch (error) {
    if (error instanceof Error && error.name === "TimeoutError") {
      console.warn("LeetCode API timed out after 5s");
    } else {
      console.error("LeetCode Fetch Error:", error);
    }
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
    const response = await fetch(url, { signal: AbortSignal.timeout(5000) });
    const data = await response.json();

    if (data.status !== "OK") return null;

    // Find the specific problem in the contest
    const problem = data.result.problems.find((p: { index: string }) => p.index === index);

    if (!problem) return null;

    return {
      realTitle: `${contestId}${index} - ${problem.name}`, // Format: "4A - Watermelon"
      rating: problem.rating,
      tags: problem.tags,
      contestId: contestId,
      problemIndex: index,
    };
  } catch (error) {
    if (error instanceof Error && error.name === "TimeoutError") {
      console.warn("Codeforces API timed out after 5s");
    } else {
      console.error("Codeforces Fetch Error:", error);
    }
    return null;
  }
}


/**
 * MAIN ENRICHMENT FUNCTION
 * Detects platform and calls the right fetcher.
 *
 * Parsing is done on the URL's pathname segments (via the WHATWG URL parser),
 * so query strings (?tab=...), fragments (#...), and trailing slashes can never
 * corrupt the extracted slug / contest id / problem index.
 */
export async function enrichProblemData(url: string): Promise<ProblemMetadata | null> {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }

  const host = parsed.hostname.toLowerCase();
  const segments = parsed.pathname.split("/").filter(Boolean);

  // A. LEETCODE — .../problems/<slug>/...
  if (host.includes("leetcode.com")) {
    const idx = segments.indexOf("problems");
    const slug = idx !== -1 ? segments[idx + 1] : undefined;
    if (slug) return await fetchLeetCodeData(slug.toLowerCase());
    return null;
  }

  // B. CODEFORCES — /contest/<id>/problem/<index>, /gym/<id>/problem/<index>,
  //    or /problemset/problem/<id>/<index>
  if (host.includes("codeforces.com")) {
    let contestId = "";
    let index = "";

    const baseIdx = segments.indexOf("contest") !== -1
      ? segments.indexOf("contest")
      : segments.indexOf("gym");

    if (baseIdx !== -1 && segments[baseIdx + 1]) {
      contestId = segments[baseIdx + 1];
      const probIdx = segments.indexOf("problem", baseIdx);
      if (probIdx !== -1 && segments[probIdx + 1]) index = segments[probIdx + 1];
    } else {
      const psIdx = segments.indexOf("problemset");
      if (psIdx !== -1 && segments[psIdx + 1] === "problem" && segments[psIdx + 2] && segments[psIdx + 3]) {
        contestId = segments[psIdx + 2];
        index = segments[psIdx + 3];
      }
    }

    if (contestId && index) {
      // Codeforces problem indexes are uppercase (A, B, C1, ...).
      return await fetchCodeforcesData(contestId, index.toUpperCase());
    }
    return null;
  }

  return null;
}