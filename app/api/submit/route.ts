import { auth, currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { enrichProblemData } from "@/lib/services";
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
 * Recomputes and writes the community average difficulty for a problem.
 * Called after every submission create/edit that touches difficultyRating.
 */
async function recomputeProblemAvgDifficulty(problemSlug: string): Promise<void> {
  const agg = await prisma.submission.aggregate({
    where: {
      problemSlug,
      difficultyRating: { not: null },
    },
    _avg: { difficultyRating: true },
  });

  const avg = agg._avg.difficultyRating;

  // Only update if there is at least one rated submission; otherwise leave existing value
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
    const difficulty = parseFloat(formData.get("difficulty") as string);
    const manualTags = JSON.parse(formData.get("tags") as string) as string[];
    const notes = formData.get("notes") as string;

    // Resolve the user's personal difficulty rating (null if unrated / invalid)
    const difficultyRating =
      !isNaN(difficulty) && difficulty >= 0 && difficulty <= 10 ? difficulty : null;

    // 3. Smart Enrichment
    const enrichedData = await enrichProblemData(url);

    // 4. Tag Merging (manual + enriched, deduplicated)
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

    // 5. Determine Final Title
    let displayTitle = enrichedData?.realTitle;
    if (!displayTitle) {
      const urlParts = url.split("/").filter(Boolean);
      const lastPart = urlParts.length > 0 ? urlParts[urlParts.length - 1] : "Unknown";
      displayTitle = "Problem " + lastPart;
    }

    // 6. Process Main Code
    const mainResult = await processCodeInput(
      formData.get("file") as File | null,
      formData.get("code") as string
    );

    if (!mainResult) {
      return NextResponse.json({ error: "No solution code provided" }, { status: 400 });
    }

    // 7. Process Alternate Solutions (up to MAX_ALT_SOLUTIONS)
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

    // 8. Determine Problem Slug & Platform
    const platform = detectPlatform(url);
    const problemSlug = displayTitle
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");

    // 9. Ensure User exists in SQL (Clerk → SQL sync)
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

    // 10. Upsert Problem (difficultyValue will be set by recomputeProblemAvgDifficulty below)
    await prisma.problem.upsert({
      where: { slug: problemSlug },
      update: {},
      create: {
        slug: problemSlug,
        title: displayTitle,
        difficultyValue: difficultyRating, // Initial value until avg is computed
        difficultyLabel: enrichedData?.difficultyLabel || null,
        platform,
        url: url || null,
        rating: enrichedData?.rating ?? null,
      },
    });

    // 11. Create Main Submission
    const submissionId = crypto.randomUUID();
    await prisma.submission.create({
      data: {
        id: submissionId,
        language: mainResult.ext,
        codeSnippet: mainResult.content,
        notes: notes || null,
        status: "SOLVED",
        tags: submissionTags,
        difficultyRating,
        userId,
        problemSlug,
      },
    });

    // 12. Create Alternate Submissions (if any provided)
    for (const alt of altResults) {
      await prisma.submission.create({
        data: {
          id: crypto.randomUUID(),
          language: alt.ext,
          codeSnippet: alt.content,
          notes: alt.label,
          status: "SOLVED",
          tags: submissionTags,
          difficultyRating, // Alternates share the same rating as main submission
          userId,
          problemSlug,
        },
      });
    }

    // 13. Recompute community average difficulty for this problem
    await recomputeProblemAvgDifficulty(problemSlug);

    // 14. Update user stats (+1 per problem submission, regardless of number of alternates)
    await prisma.user.update({
      where: { id: userId },
      data: {
        totalSolved: { increment: 1 },
      },
    });

    return NextResponse.json({ success: true, id: submissionId });

  } catch (error: unknown) {
    console.error("Submission Failed:", error);
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}