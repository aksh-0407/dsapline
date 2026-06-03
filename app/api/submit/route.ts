import { auth, currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import prisma from "@/lib/prisma";
import { enrichProblemData } from "@/lib/services";
import { titleToSlug, resolveDisplayName } from "@/lib/utils";
import { recomputeProblemAvgDifficulty } from "@/lib/problem-stats";
import { recomputeUserStreaks } from "@/lib/streaks";
import { revalidateAfterWrite } from "@/lib/cache";
import path from "path";

// --- CONFIGURATION ---
const MAX_FILE_SIZE = 1 * 1024 * 1024;   // 1 MB per uploaded file
const MAX_CODE_LENGTH = 1_000_000;        // 1M chars cap for pasted code
const MAX_ALT_SOLUTIONS = 10;
const MAX_TAGS = 30;
const MAX_TAG_LENGTH = 50;

type Platform = "leetcode" | "codeforces" | "hackerrank" | "geeksforgeeks" | "other";

function detectPlatform(url: string): Platform {
  const lowerUrl = url.toLowerCase();
  if (lowerUrl.includes("leetcode")) return "leetcode";
  if (lowerUrl.includes("codeforces")) return "codeforces";
  if (lowerUrl.includes("hackerrank")) return "hackerrank";
  if (lowerUrl.includes("geeksforgeeks")) return "geeksforgeeks";
  return "other";
}

/**
 * Resolve code from either an uploaded file or pasted text.
 * - Uploaded files keep their real extension (most accurate language hint).
 * - Pasted code falls back to the language the user selected in the form.
 */
async function processCodeInput(file: File | null, text: string, fallbackLang: string) {
  if (file && file.size > 0) {
    if (file.size > MAX_FILE_SIZE) throw new Error("File exceeds 1MB limit.");
    const content = await file.text();
    const ext = path.extname(file.name).replace(".", "").toLowerCase() || fallbackLang || "txt";
    return { content, ext };
  }
  if (text && text.trim()) {
    if (text.length > MAX_CODE_LENGTH) throw new Error("Pasted code is too large (1M char limit).");
    return { content: text, ext: fallbackLang || "txt" };
  }
  return null;
}

/** Parse the JSON tag payload defensively — never throw on bad input. */
function parseTags(raw: FormDataEntryValue | null): string[] {
  if (typeof raw !== "string") return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((t): t is string => typeof t === "string");
  } catch {
    return [];
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
    const manualTags = parseTags(formData.get("tags"));
    const notes = (formData.get("notes") as string) || "";
    // Optional solution title (label for this approach)
    const solutionTitle = (formData.get("solutionTitle") as string) || null;
    // Selected language (used for pasted code; uploads keep their extension)
    const language = ((formData.get("language") as string) || "cpp").trim().toLowerCase() || "cpp";

    // Resolve the user's personal difficulty rating (null if unrated / invalid)
    const difficultyRating =
      !isNaN(difficulty) && difficulty >= 0 && difficulty <= 10 ? difficulty : null;

    // 4. Smart Enrichment (external fetch — kept OUTSIDE the DB transaction)
    const enrichedData = await enrichProblemData(url);

    // 5. Tag Merging (manual + enriched, deduplicated, sanitised & capped)
    const allTags = [...manualTags, ...(enrichedData?.tags || [])];
    const submissionTags = Array.from(
      new Map(
        allTags
          .filter((tag) => typeof tag === "string" && tag.trim())
          .map((tag) => {
            const trimmed = tag.trim().slice(0, MAX_TAG_LENGTH);
            const key = trimmed.toLowerCase().replace(/[^a-z0-9]/g, "");
            const formatted = trimmed.replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
            return [key, formatted];
          })
      ).values()
    ).slice(0, MAX_TAGS);

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
      formData.get("code") as string,
      language
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

      const altResult = await processCodeInput(altFile, altCode, language);
      if (altResult) {
        altResults.push({ ...altResult, label: altLabel });
      }
    }

    // 9. Determine Problem Slug & Platform
    //    Uses the shared titleToSlug utility — same function used by parse-url
    //    so slug generation is always consistent.
    const platform = detectPlatform(url);
    const problemSlug = titleToSlug(displayTitle);

    const email = user.emailAddresses[0]?.emailAddress ?? `${userId}@clerk.user`;
    const fullName = resolveDisplayName(user.firstName, user.lastName, email, userId);
    const submissionId = crypto.randomUUID();

    // 10. All DB writes run in a single transaction so a mid-flight failure
    //     can never leave totalSolved, SolvedProblem, and Submission rows out
    //     of sync. The external enrichment above is intentionally outside it.
    const result = await prisma.$transaction(async (tx) => {
      // 10a. Ensure User exists in SQL (Clerk → SQL sync)
      await tx.user.upsert({
        where: { id: userId },
        update: { fullName, email },
        create: { id: userId, email, fullName },
      });

      // 10b. Upsert Problem
      await tx.problem.upsert({
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

      // 10c. SolvedProblem — has this user solved this problem before?
      const existingSolvedProblem = await tx.solvedProblem.findUnique({
        where: { userId_problemSlug: { userId, problemSlug } },
      });

      let solvedProblem: { id: string };
      let isFirstSolve: boolean;

      if (!existingSolvedProblem) {
        // CASE A — FIRST SOLVE: create SolvedProblem + increment totalSolved
        isFirstSolve = true;
        solvedProblem = await tx.solvedProblem.create({
          data: {
            userId,
            problemSlug,
            notes: notes || null,
            tags: submissionTags,
            difficultyRating,
            lastAttemptedAt: new Date(),
          },
        });
        await tx.user.update({
          where: { id: userId },
          data: { totalSolved: { increment: 1 } },
        });
      } else {
        // CASE B — RE-SUBMISSION: update metadata + bump lastAttemptedAt
        isFirstSolve = false;
        solvedProblem = await tx.solvedProblem.update({
          where: { id: existingSolvedProblem.id },
          data: {
            notes: notes || existingSolvedProblem.notes,
            tags: submissionTags.length > 0 ? submissionTags : existingSolvedProblem.tags,
            difficultyRating: difficultyRating ?? existingSolvedProblem.difficultyRating,
            lastAttemptedAt: new Date(), // float to top of archive
          },
        });
      }

      // 10d. Main Submission (isMainSolution true only on the first solve)
      await tx.submission.create({
        data: {
          id: submissionId,
          language: mainResult.ext,
          codeSnippet: mainResult.content,
          notes: notes || null,
          title: solutionTitle || null,
          status: "SOLVED",
          tags: submissionTags,
          difficultyRating,
          isMainSolution: isFirstSolve,
          userId,
          problemSlug,
          solvedProblemId: solvedProblem.id,
        },
      });

      // 10e. Alternate Submissions
      for (const alt of altResults) {
        await tx.submission.create({
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

      // 10f. Recompute community average difficulty + this user's streaks
      await recomputeProblemAvgDifficulty(tx, problemSlug);
      await recomputeUserStreaks(tx, userId);

      return { solvedProblemId: solvedProblem.id, isFirstSolve };
    });

    // 11. Invalidate caches so the new data appears immediately.
    revalidateAfterWrite(userId);
    revalidatePath("/");
    revalidatePath("/archive");
    revalidatePath("/leaderboard");
    revalidatePath(`/user/${userId}`);

    return NextResponse.json({
      success: true,
      id: submissionId,
      solvedProblemId: result.solvedProblemId,
      isFirstSolve: result.isFirstSolve,
    });
  } catch (error: unknown) {
    console.error("Submission Failed:", error);
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
