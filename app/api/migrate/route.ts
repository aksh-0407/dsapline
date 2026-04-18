import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@clerk/nextjs/server";
import { toISTDateString, todayIST, yesterdayIST } from "@/lib/date";
import fs from "fs/promises";
import path from "path";

// ======================================================================
// TYPES — Shape of the source JSON files
// ======================================================================

interface IndexEntry {
  id: string;
  title: string;
  difficulty: number; // -1 = unrated
  tags: string[];
  username: string;
  userId: string;
  date: string; // "YYYY-MM-DD"
  timestamp: string; // ISO 8601
  platform: string;
  difficultyLabel?: string;
  rating?: number;
}

interface SubmissionDetail {
  id: string;
  userId: string;
  username: string;
  question?: { url?: string; title?: string };
  difficulty: number;
  tags: string[];
  notes?: string;
  timestamp: string;
  mainSolution?: { path?: string; extension?: string };
  alternateSolution?: { label?: string; path?: string; extension?: string } | null;
  platform: string;
  enrichment?: { realTitle?: string; difficultyLabel?: string };
}

interface UserJson {
  userId: string;
  username: string;
  joinDate?: string;
}

// ======================================================================
// HELPERS
// ======================================================================

// eslint-disable-next-line @typescript-eslint/no-require-imports
const DATA_DIR = /* turbopackIgnore: true */ require("path").join(process.cwd(), "data");

/** Read a local JSON file, return parsed content or null. */
async function readLocalJson<T>(filePath: string): Promise<T | null> {
  try {
    const abs = path.isAbsolute(filePath)
      ? filePath
      : path.join(process.cwd(), filePath);
    const raw = await fs.readFile(abs, "utf-8");
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

/** Read a local text file, return string or null. */
async function readLocalText(filePath: string): Promise<string | null> {
  try {
    const abs = path.isAbsolute(filePath)
      ? filePath
      : path.join(process.cwd(), filePath);
    return await fs.readFile(abs, "utf-8");
  } catch {
    return null;
  }
}

/**
 * Calculate streaks from a sorted list of YYYY-MM-DD date strings.
 *
 * RULES:
 *  - currentStreak: consecutive days counting back from today/yesterday.
 *    If the most recent date is not today or yesterday, currentStreak = 0.
 *  - maxStreak: longest consecutive chain ever.
 *  - Duplicates are collapsed (same day = 1).
 */
function calculateStreaks(dates: string[]): { currentStreak: number; maxStreak: number } {
  if (dates.length === 0) return { currentStreak: 0, maxStreak: 0 };

  // Unique, sorted ascending
  const uniqueDates = Array.from(new Set(dates)).sort();

  // --- Max Streak ---
  let maxStreak = 1;
  let runStreak = 1;
  for (let i = 1; i < uniqueDates.length; i++) {
    const prev = new Date(uniqueDates[i - 1] + "T12:00:00Z");
    const curr = new Date(uniqueDates[i] + "T12:00:00Z");
    const diffDays = Math.round((curr.getTime() - prev.getTime()) / 86400000);

    if (diffDays === 1) {
      runStreak++;
      if (runStreak > maxStreak) maxStreak = runStreak;
    } else {
      runStreak = 1;
    }
  }

  // --- Current Streak (backward from today/yesterday) ---
  let currentStreak = 0;
  const today = todayIST();
  const yesterday = yesterdayIST();

  const sortedDesc = [...uniqueDates].sort((a, b) => b.localeCompare(a));
  const mostRecent = sortedDesc[0];

  if (mostRecent === today || mostRecent === yesterday) {
    const checkDate = new Date(mostRecent + "T12:00:00Z");
    for (const dateStr of sortedDesc) {
      const expected = toISTDateString(checkDate);
      if (dateStr === expected) {
        currentStreak++;
        checkDate.setDate(checkDate.getDate() - 1);
      } else {
        break;
      }
    }
  }

  return { currentStreak, maxStreak };
}

/**
 * Compute Problem.difficultyValue as the average of all non-null ratings
 * for a given problemSlug. Returns null if no rated submissions.
 */
async function computeProblemAvgDifficulty(problemSlug: string): Promise<number | null> {
  const agg = await prisma.submission.aggregate({
    where: { problemSlug, difficultyRating: { not: null } },
    _avg: { difficultyRating: true },
  });
  return agg._avg.difficultyRating;
}

// ======================================================================
// MAIN MIGRATION ROUTE
// ======================================================================

export async function POST(req: Request) {
  try {
    // --- Auth + secret guard ---
    const { userId } = await auth();
    if (!userId && process.env.NODE_ENV !== "development") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    if (body.confirm !== "RESET_ALL_DATA") {
      return NextResponse.json(
        { error: "Safety: Send { confirm: 'RESET_ALL_DATA' } in body." },
        { status: 400 }
      );
    }

    // MIGRATE_SECRET guard — prevents anyone with the hardcoded confirm string
    // from wiping the database in production. Set this env var in .env.local and
    // in the Vercel dashboard before running the migration.
    const migrateSecret = process.env.MIGRATE_SECRET;
    if (migrateSecret && body.secret !== migrateSecret) {
      return NextResponse.json(
        { error: "Invalid migration secret. Check MIGRATE_SECRET env var." },
        { status: 403 }
      );
    }

    console.log(`\n=== MIGRATION triggered by ${userId} ===\n`);

    // ==================================================================
    // STEP 0: CLEAR ALL TABLES (cascading order)
    // ==================================================================
    console.log("Clearing existing data...");
    await prisma.submissionHistory.deleteMany();
    await prisma.comment.deleteMany();
    await prisma.submission.deleteMany();
    await prisma.solvedProblem.deleteMany();
    await prisma.problem.deleteMany();
    await prisma.user.deleteMany();
    console.log("  ✓ All tables cleared.\n");

    // ==================================================================
    // STEP 1: LOAD INDEX (Single source of truth for "what was solved")
    // ==================================================================
    const indexData = await readLocalJson<IndexEntry[]>(path.join(DATA_DIR, "index.json"));
    if (!indexData || !Array.isArray(indexData) || indexData.length === 0) {
      return NextResponse.json({ error: "No index data found at data/index.json" }, { status: 404 });
    }
    console.log(`Loaded ${indexData.length} entries from index.json`);

    const stats = {
      users: 0,
      problems: 0,
      solvedProblems: 0,
      mainSubmissions: 0,
      altSubmissions: 0,
      codeFound: 0,
      codeMissing: 0,
    };

    // ==================================================================
    // STEP 2: COMPUTE USER STATS FROM INDEX
    //
    // totalSolved = number of UNIQUE (userId, problemSlug) pairs.
    // Streaks are computed from unique dates in this user's entries.
    // ==================================================================
    const userMap: Record<
      string,
      { username: string; dates: string[]; slugs: Set<string>; earliestTimestamp: string }
    > = {};

    for (const entry of indexData) {
      const slug = entry.title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "");

      if (!userMap[entry.userId]) {
        userMap[entry.userId] = {
          username: entry.username,
          dates: [],
          slugs: new Set(),
          earliestTimestamp: entry.timestamp || entry.date,
        };
      }
      const u = userMap[entry.userId];
      u.dates.push(entry.date);
      u.slugs.add(slug); // unique problem slugs
      if (new Date(entry.timestamp || entry.date) < new Date(u.earliestTimestamp)) {
        u.earliestTimestamp = entry.timestamp || entry.date;
      }
    }

    // Enrich usernames from user JSON files
    const enrichedNames: Record<string, string> = {};
    for (const uid of Object.keys(userMap)) {
      const userFile = await readLocalJson<UserJson>(
        path.join(DATA_DIR, "users", `${uid}.json`)
      );
      if (userFile?.username) {
        enrichedNames[uid] = userFile.username;
      }
    }

    // Create User rows
    for (const [uid, data] of Object.entries(userMap)) {
      const { currentStreak, maxStreak } = calculateStreaks(data.dates);
      const displayName = enrichedNames[uid] || data.username;
      const totalSolved = data.slugs.size; // unique problems, not raw entry count

      await prisma.user.create({
        data: {
          id: uid,
          email: `${uid}@migrated.dsapline`,
          fullName: displayName,
          totalSolved,
          currentStreak,
          maxStreak,
          createdAt: new Date(data.earliestTimestamp),
        },
      });
      stats.users++;
      console.log(
        `  User: ${displayName} | solved: ${totalSolved} | streak: ${currentStreak}/${maxStreak}`
      );
    }
    console.log(`  ✓ ${stats.users} users created.\n`);

    // ==================================================================
    // STEP 3: CREATE PROBLEMS (deduplicated by slug)
    // ==================================================================
    const problemCache = new Map<string, boolean>();

    for (const entry of indexData) {
      const slug = entry.title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "");

      if (problemCache.has(slug)) continue;
      problemCache.set(slug, true);

      await prisma.problem.create({
        data: {
          slug,
          title: entry.title,
          difficultyValue: null, // Recomputed after all submissions
          difficultyLabel: entry.difficultyLabel || null,
          platform: entry.platform || "other",
          url: null, // Populated from detail JSON below
          rating: entry.rating || null,
        },
      });
      stats.problems++;
    }
    console.log(`  ✓ ${stats.problems} problems created.\n`);

    // ==================================================================
    // STEP 4: CREATE SOLVED PROBLEMS + SUBMISSIONS
    //
    // For each index entry:
    //   a. UPSERT SolvedProblem { userId, problemSlug }
    //      - firstSolvedAt = entry.timestamp (only set on INSERT)
    //      - tags/notes/difficultyRating from detail JSON
    //   b. Create main Submission { isMainSolution: true }
    //   c. If alternateSolution present → Create alt Submission { isMainSolution: false }
    //
    // Because index.json has exactly one entry per original solve event,
    // each entry naturally maps to a unique SolvedProblem.
    // ==================================================================

    // Track SolvedProblem ids by (userId, slug) so we can link submissions
    const solvedProblemCache = new Map<string, string>(); // `${userId}:${slug}` → sp.id

    for (const entry of indexData) {
      const slug = entry.title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "");

      const dateObj = new Date(entry.timestamp || entry.date);
      const year = dateObj.getUTCFullYear();
      const month = String(dateObj.getUTCMonth() + 1).padStart(2, "0");
      const cleanTitle = entry.title.replace(/[^a-zA-Z0-9]/g, "");

      const baseName = `${entry.date}_${cleanTitle}_${entry.username}_${entry.id}`;
      const detailJsonPath = path.join(
        DATA_DIR,
        "submissions",
        String(year),
        month,
        `${baseName}.json`
      );

      const detail = await readLocalJson<SubmissionDetail>(detailJsonPath);

      // --- Difficulty handling ---
      const rawDiff = detail?.difficulty ?? entry.difficulty;
      const difficultyRating =
        typeof rawDiff === "number" && rawDiff >= 0 && rawDiff <= 10 ? rawDiff : null;

      // --- Enrich Problem with URL and difficultyLabel from detail ---
      if (detail?.question?.url || detail?.enrichment?.difficultyLabel) {
        await prisma.problem.update({
          where: { slug },
          data: {
            url: detail?.question?.url || undefined,
            difficultyLabel: detail?.enrichment?.difficultyLabel || undefined,
          },
        });
      }

      // --- Upsert SolvedProblem ---
      const spKey = `${entry.userId}:${slug}`;
      let spId = solvedProblemCache.get(spKey);
      const isFirstTimeSeen = !spId;

      if (isFirstTimeSeen) {
        // First time we see this (userId, slug) pair → CREATE
        const sp = await prisma.solvedProblem.create({
          data: {
            userId: entry.userId,
            problemSlug: slug,
            firstSolvedAt: dateObj,
            lastAttemptedAt: dateObj,  // Set historically; we own this field now
            notes: detail?.notes || null,
            tags: detail?.tags || entry.tags || [],
            difficultyRating,
          },
        });
        spId = sp.id;
        solvedProblemCache.set(spKey, spId);
        stats.solvedProblems++;
      } else {
        // ── DUPLICATE ENTRY (same userId + slug, appears again in index.json) ──
        // Merge strategy (industry-standard, no data loss):
        //   • tags           → set UNION (keep all unique tags)
        //   • notes          → APPEND if new notes differ (preserve all learnings)
        //   • difficulty     → LATEST entry wins (most recent assessment is most accurate)
        //   • firstSolvedAt  → never updated (set on CREATE, immutable)
        //   • lastAttemptedAt → take MAX(existing, incoming) — most recent date wins

        const existing = await prisma.solvedProblem.findUnique({
          where: { id: spId },
          select: { notes: true, tags: true, lastAttemptedAt: true },
        });

        // Tag union: merge existing + new tags, deduplicated
        const existingTags = existing?.tags ?? [];
        const newTags = detail?.tags || entry.tags || [];
        const mergedTags = Array.from(new Set([...existingTags, ...newTags]));

        // Notes: append if new notes exist and differ from existing
        let mergedNotes = existing?.notes || null;
        const incomingNotes = detail?.notes?.trim() || null;
        if (incomingNotes && incomingNotes !== mergedNotes) {
          mergedNotes = mergedNotes
            ? `${mergedNotes}\n---\n${incomingNotes}`
            : incomingNotes;
        }

        // lastAttemptedAt: keep the later of the two dates
        const currentLast = existing?.lastAttemptedAt ?? new Date(0);
        const newLastAttemptedAt = dateObj > currentLast ? dateObj : currentLast;

        await prisma.solvedProblem.update({
          where: { id: spId },
          data: {
            tags: mergedTags,
            notes: mergedNotes,
            lastAttemptedAt: newLastAttemptedAt,
            // Latest difficulty wins — most recent understanding is most accurate
            difficultyRating: difficultyRating ?? undefined,
          },
        });
      }

      // --- Read main code ---
      let mainCode = "// Code snippet could not be retrieved.";
      let mainExt = "txt";

      if (detail?.mainSolution?.path) {
        const code = await readLocalText(detail.mainSolution.path);
        if (code) {
          mainCode = code;
          mainExt = detail.mainSolution.extension || "txt";
          stats.codeFound++;
        } else {
          stats.codeMissing++;
        }
      } else {
        // Fallback: try the .txt file directly
        const txtPath = path.join(
          DATA_DIR,
          "submissions",
          String(year),
          month,
          `${baseName}.txt`
        );
        const code = await readLocalText(txtPath);
        if (code) {
          mainCode = code;
          stats.codeFound++;
        } else {
          stats.codeMissing++;
        }
      }

      // --- Create main submission ---
      // First occurrence → isMainSolution: true; subsequent → false
      const isMainSolution = isFirstTimeSeen;

      // Determine a meaningful title for non-main submissions
      const submissionTitle = isMainSolution
        ? null
        : (() => {
            if (detail?.alternateSolution?.label) return detail.alternateSolution.label;
            const notesTrimmed = detail?.notes?.trim();
            if (notesTrimmed) return notesTrimmed.slice(0, 60) + (notesTrimmed.length > 60 ? "…" : "");
            const d = new Date(entry.timestamp || entry.date);
            return `Re-submission (${d.toISOString().slice(0, 10)})`;
          })();

      await prisma.submission.create({
        data: {
          id: entry.id,
          language: mainExt,
          codeSnippet: mainCode,
          notes: detail?.notes || null,
          title: submissionTitle,
          status: "SOLVED",
          tags: detail?.tags || entry.tags || [],
          difficultyRating,
          isMainSolution,
          userId: entry.userId,
          problemSlug: slug,
          solvedProblemId: spId!,
          createdAt: dateObj,
        },
      });
      stats.mainSubmissions++;

      // --- Create alternate submission (if present) ---
      if (detail?.alternateSolution?.path) {
        const altCode = await readLocalText(detail.alternateSolution.path);
        const altContent = altCode || "// Alternate code snippet not found.";
        const altExt = detail.alternateSolution.extension || mainExt;

        await prisma.submission.create({
          data: {
            id: `${entry.id}-alt`,
            language: altExt,
            codeSnippet: altContent,
            title: detail.alternateSolution.label || "Alternate Solution",
            notes: null,
            status: "SOLVED",
            tags: detail?.tags || entry.tags || [],
            difficultyRating,
            isMainSolution: false,
            userId: entry.userId,
            problemSlug: slug,
            solvedProblemId: spId!,
            createdAt: dateObj,
          },
        });
        stats.altSubmissions++;
      }
    }

    console.log(
      `  ✓ ${stats.solvedProblems} SolvedProblem rows created.`
    );
    console.log(
      `  ✓ ${stats.mainSubmissions} main submissions + ${stats.altSubmissions} alternates created.`
    );
    console.log(
      `    Code found: ${stats.codeFound} | Code missing: ${stats.codeMissing}\n`
    );

    // ==================================================================
    // STEP 5: RECOMPUTE Problem.difficultyValue FOR ALL PROBLEMS
    // ==================================================================
    let problemsUpdated = 0;
    for (const slug of problemCache.keys()) {
      const avg = await computeProblemAvgDifficulty(slug);
      if (avg !== null) {
        await prisma.problem.update({
          where: { slug },
          data: { difficultyValue: avg },
        });
        problemsUpdated++;
      }
    }
    console.log(`  ✓ Recomputed average difficulty for ${problemsUpdated} problems.\n`);

    // ==================================================================
    // STEP 6: RECOMPUTE user.totalSolved FROM SolvedProblem COUNT
    //
    // Belt-and-suspenders: recompute totalSolved from the actual
    // SolvedProblem rows to ensure perfect accuracy regardless of
    // any edge cases in Step 2.
    // ==================================================================
    const grouped = await prisma.solvedProblem.groupBy({
      by: ["userId"],
      _count: { id: true },
    });

    for (const row of grouped) {
      await prisma.user.update({
        where: { id: row.userId },
        data: { totalSolved: row._count.id },
      });
    }
    console.log(`  ✓ Recomputed totalSolved for ${grouped.length} users.\n`);

    // ==================================================================
    // SUMMARY
    // ==================================================================
    const summary = {
      users: stats.users,
      problems: stats.problems,
      solvedProblems: stats.solvedProblems,
      mainSubmissions: stats.mainSubmissions,
      altSubmissions: stats.altSubmissions,
      totalSubmissionRows: stats.mainSubmissions + stats.altSubmissions,
      codeFound: stats.codeFound,
      codeMissing: stats.codeMissing,
      problemsWithAvgDifficulty: problemsUpdated,
    };

    console.log("=== MIGRATION COMPLETE ===");
    console.log(JSON.stringify(summary, null, 2));

    return NextResponse.json({
      success: true,
      message: "Migration complete. All stats recomputed from source data.",
      summary,
    });
  } catch (error) {
    console.error("Fatal Migration Error:", error);
    return NextResponse.json({ error: "Migration failed. Check console." }, { status: 500 });
  }
}