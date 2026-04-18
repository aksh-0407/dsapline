import { auth, currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { revalidatePath, revalidateTag } from "next/cache";
import prisma from "@/lib/prisma";
import { enrichProblemData } from "@/lib/services";
import { titleToSlug } from "@/lib/utils";
import path from "path";

// --- CONFIGURATION ---
const MAX_FILE_SIZE = 1 * 1024 * 1024; // 1 MB
const MAX_ALT_SOLUTIONS = 10;

type Platform = "leetcode" | "codeforces" | "hackerrank" | "geeksforgeeks" | "other";

function detectPlatform(url: string): Platform {
  const lowerUrl = url.toLowerCase();
  if (lowerUrl.includes("leetcode")) return "leetcode";
  if (lowerUrl.includes("codeforces")) return "codeforces";
  if (lowerUrl.includes("hackerrank")) return "hackerrank";
  if (lowerUrl.includes("geeksforgeeks")) return "geeksforgeeks";
  return "other";
}

async function processCodeInput(file: File | null, text: string) {
  if (file && file.size > 0) {
    if (file.size > MAX_FILE_SIZE) throw new Error("File exceeds 1MB limit.");
    const content = await file.text();
    const ext = path.extname(file.name).replace(".", "") || "txt";
    return { content, ext };
  }
  if (text && text.trim()) {
    return { content: text, ext: "txt" };
  }
  return null;
}

/**
 * Recomputes the community average difficulty for a problem.
 * Averages over SolvedProblem rows (one per user) so that a user who
 * submits 3 alternate solutions counts exactly once — not 3 times.
 */
async function recomputeProblemAvgDifficulty(problemSlug: string): Promise<void> {
  const agg = await prisma.solvedProblem.aggregate({
    where: {
      problemSlug,
      difficultyRating: { not: null },
    },
    _avg: { difficultyRating: true },
  });

  const avg = agg._avg.difficultyRating;
  if (avg !== null) {
    await prisma.problem.update({
      where: { slug: problemSlug },
      data: { difficultyValue: avg },
    });
  }
}

export async function POST(req: Request) {
  try {
    // 1. Security & Identity
    const { userId } = await auth();
    const user = await currentUser();

    if (!userId || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 2. Parse Form
    const formData = await req.formData();
    const url = formData.get("url") as string;

    // 3. Validate URL format — reject non-http(s) and malformed URLs
    if (!url) {
      return NextResponse.json({ error: "Problem URL is required" }, { status: 400 });
    }
    try {
      const parsed = new URL(url);
      if (!["http:", "https:"].includes(parsed.protocol)) {
        return NextResponse.json({ error: "URL must use http or https" }, { status: 400 });
      }
    } catch {
      return NextResponse.json({ error: "Invalid URL format" }, { status: 400 });
    }

    const difficulty = parseFloat(formData.get("difficulty") as string);
    const manualTags = JSON.parse(formData.get("tags") as string) as string[];
    const notes = formData.get("notes") as string;
    // Optional solution title (label for this approach)
    const solutionTitle = (formData.get("solutionTitle") as string) || null;

    // Resolve the user's personal difficulty rating (null if unrated / invalid)
    const difficultyRating =
      !isNaN(difficulty) && difficulty >= 0 && difficulty <= 10 ? difficulty : null;

    // 4. Smart Enrichment
    const enrichedData = await enrichProblemData(url);

    // 5. Tag Merging (manual + enriched, deduplicated)
    const allTags = [...manualTags, ...(enrichedData?.tags || [])];
    const submissionTags = Array.from(
      new Map(
        allTags.map((tag) => {
          const key = tag.toLowerCase().replace(/[^a-z0-9]/g, "");
          const formatted = tag.replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
          return [key, formatted];
        })
      ).values()
    );

    // 6. Determine Final Title
    let displayTitle = enrichedData?.realTitle;
    if (!displayTitle) {
      const urlParts = url.split("/").filter(Boolean);
      const lastPart = urlParts.length > 0 ? urlParts[urlParts.length - 1] : "Unknown";
      displayTitle = "Problem " + lastPart;
    }

    // 7. Process Main Code
    const mainResult = await processCodeInput(
      formData.get("file") as File | null,
      formData.get("code") as string
    );

    if (!mainResult) {
      return NextResponse.json({ error: "No solution code provided" }, { status: 400 });
    }

    // 8. Process Alternate Solutions (up to MAX_ALT_SOLUTIONS)
    const altResults: Array<{ content: string; ext: string; label: string }> = [];

    for (let i = 0; i < MAX_ALT_SOLUTIONS; i++) {
      const altLabel = (formData.get(`alt_label_${i}`) as string) || `Alternate Solution ${i + 1}`;
      const altFile = formData.get(`alt_file_${i}`) as File | null;
      const altCode = formData.get(`alt_code_${i}`) as string;

      const altResult = await processCodeInput(altFile, altCode);
      if (altResult) {
        altResults.push({ ...altResult, label: altLabel });
      }
    }

    // 9. Determine Problem Slug & Platform
    //    Uses the shared titleToSlug utility — same function used by parse-url
    //    so slug generation is always consistent.
    const platform = detectPlatform(url);
    const problemSlug = titleToSlug(displayTitle);

    // 10. Ensure User exists in SQL (Clerk → SQL sync)
    const fullName = `${user.firstName} ${user.lastName || ""}`.trim();
    await prisma.user.upsert({
      where: { id: userId },
      update: { fullName, email: user.emailAddresses[0]?.emailAddress ?? `${userId}@clerk.user` },
      create: {
        id: userId,
        email: user.emailAddresses[0]?.emailAddress ?? `${userId}@clerk.user`,
        fullName,
      },
    });

    // 11. Upsert Problem
    await prisma.problem.upsert({
      where: { slug: problemSlug },
      update: {},
      create: {
        slug: problemSlug,
        title: displayTitle,
        difficultyValue: null, // Recomputed after submission
        difficultyLabel: enrichedData?.difficultyLabel || null,
        platform,
        url: url || null,
        rating: enrichedData?.rating ?? null,
      },
    });

    // 12. SolvedProblem — check if this user has solved this problem before
    const existingSolvedProblem = await prisma.solvedProblem.findUnique({
      where: { userId_problemSlug: { userId, problemSlug } },
    });

    let solvedProblem: { id: string };
    let isFirstSolve: boolean;

    if (!existingSolvedProblem) {
      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      // CASE A — FIRST SOLVE
      //   • Create SolvedProblem row
      //   • Increment user.totalSolved
      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      isFirstSolve = true;

      solvedProblem = await prisma.solvedProblem.create({
        data: {
          userId,
          problemSlug,
          notes: notes || null,
          tags: submissionTags,
          difficultyRating,
          lastAttemptedAt: new Date(),
        },
      });

      // Increment totalSolved only on a genuinely new solve
      await prisma.user.update({
        where: { id: userId },
        data: { totalSolved: { increment: 1 } },
      });
    } else {
      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      // CASE B — RE-SUBMISSION
      //   • Update SolvedProblem metadata + lastAttemptedAt
      //   • totalSolved unchanged
      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      isFirstSolve = false;

      solvedProblem = await prisma.solvedProblem.update({
        where: { id: existingSolvedProblem.id },
        data: {
          notes: notes || existingSolvedProblem.notes,
          tags: submissionTags.length > 0 ? submissionTags : existingSolvedProblem.tags,
          difficultyRating: difficultyRating ?? existingSolvedProblem.difficultyRating,
          lastAttemptedAt: new Date(),  // Explicitly bump — float to top of archive
        },
      });
    }

    // 13. Create Main Submission (linked to SolvedProblem)
    const submissionId = crypto.randomUUID();
    await prisma.submission.create({
      data: {
        id: submissionId,
        language: mainResult.ext,
        codeSnippet: mainResult.content,
        notes: notes || null,
        title: solutionTitle || null,
        status: "SOLVED",
        tags: submissionTags,
        difficultyRating,
        isMainSolution: isFirstSolve, // true = first solve, false = re-submission
        userId,
        problemSlug,
        solvedProblemId: solvedProblem.id,
      },
    });

    // 14. Create Alternate Submissions (if any provided)
    for (const alt of altResults) {
      await prisma.submission.create({
        data: {
          id: crypto.randomUUID(),
          language: alt.ext,
          codeSnippet: alt.content,
          title: alt.label,
          notes: null,
          status: "SOLVED",
          tags: submissionTags,
          difficultyRating,
          isMainSolution: false,
          userId,
          problemSlug,
          solvedProblemId: solvedProblem.id,
        },
      });
    }

    // 15. Recompute community average difficulty for this problem
    //     (per SolvedProblem — one data point per user, not per Submission)
    await recomputeProblemAvgDifficulty(problemSlug);

    // 16. Burst Next.js Cache so new problems appear immediately
    revalidatePath("/");
    revalidatePath("/archive");
    revalidatePath("/leaderboard");
    revalidatePath(`/user/${userId}`);

    return NextResponse.json({
      success: true,
      id: submissionId,
      solvedProblemId: solvedProblem.id,
      isFirstSolve,
    });
  } catch (error: unknown) {
    console.error("Submission Failed:", error);
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}