import prisma from "./prisma";
import { IndexEntry, ArchiveEntry } from "./types";
import { toISTDateString } from "./date";
import { Prisma } from "@prisma/client";

// ---------------------------------------------------------------------------
// ARCHIVE — SolvedProblem-based (one row per unique userId+problemSlug)
// ---------------------------------------------------------------------------

type SolvedProblemWithRelations = Prisma.SolvedProblemGetPayload<{
  include: {
    problem: true;
    user: true;
    _count: { select: { submissions: true } };
    submissions: {
      where: { isMainSolution: true };
      orderBy: { createdAt: "asc" };
      take: 1;
    };
  };
}>;

function mapToArchiveEntry(sp: SolvedProblemWithRelations): ArchiveEntry {
  const mainSub = sp.submissions[0];

  return {
    id: sp.id,
    title: sp.problem.title,
    problemSlug: sp.problemSlug,
    platform: sp.problem.platform as ArchiveEntry["platform"],
    difficultyLabel: sp.problem.difficultyLabel ?? undefined,
    rating: sp.problem.rating ?? undefined,
    difficulty: sp.problem.difficultyValue ?? null,
    difficultyRating: sp.difficultyRating,
    tags: sp.tags,
    username: sp.user.fullName ?? sp.userId,
    userId: sp.userId,

    // date/timestamp represent the LAST ACTIVE date (matches sort order).
    // This is what users expect: "why is this row here? because I last touched it on X."
    date: toISTDateString(sp.lastAttemptedAt),
    timestamp: sp.lastAttemptedAt.toISOString(),
    lastAttemptedAt: sp.lastAttemptedAt.toISOString(),

    // firstSolvedAt is still available for analytics / "when did you first solve this?"
    firstSolvedAt: sp.firstSolvedAt.toISOString(),

    submissionCount: sp._count.submissions,
    mainSubmissionId: mainSub?.id,
  };
}


/**
 * getGlobalArchive()
 * Returns one ArchiveEntry per unique (userId, problemSlug) pair,
 * ordered by lastAttemptedAt DESC so recently revisited problems float top.
 */
export async function getGlobalArchive(): Promise<ArchiveEntry[]> {
  const solvedProblems = await prisma.solvedProblem.findMany({
    include: {
      problem: true,
      user: true,
      _count: { select: { submissions: true } },
      submissions: {
        where: { isMainSolution: true },
        orderBy: { createdAt: "asc" },
        take: 1,
      },
    },
    orderBy: { lastAttemptedAt: "desc" },
  });

  return solvedProblems.map(mapToArchiveEntry);
}

/**
 * getUserArchive(userId)
 * Returns ArchiveEntry[] for a single user — for the user profile page.
 */
export async function getUserArchive(userId: string): Promise<ArchiveEntry[]> {
  const solvedProblems = await prisma.solvedProblem.findMany({
    where: { userId },
    include: {
      problem: true,
      user: true,
      _count: { select: { submissions: true } },
      submissions: {
        where: { isMainSolution: true },
        orderBy: { createdAt: "asc" },
        take: 1,
      },
    },
    orderBy: { lastAttemptedAt: "desc" },
  });

  return solvedProblems.map(mapToArchiveEntry);
}

/**
 * getSubmissionsForSolvedProblem(solvedProblemId)
 * Returns all Submission rows for a SolvedProblem — used by the expandable
 * "N solutions" panel in the Archive.
 */
export async function getSubmissionsForSolvedProblem(solvedProblemId: string) {
  return prisma.submission.findMany({
    where: { solvedProblemId },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      title: true,
      language: true,
      isMainSolution: true,
      createdAt: true,
      notes: true,
    },
  });
}

// ---------------------------------------------------------------------------
// LEGACY IndexEntry mapper — kept for the dashboard recentActivity feed
// ---------------------------------------------------------------------------

type SubmissionWithRelations = Prisma.SubmissionGetPayload<{
  include: { problem: true; user: true };
}>;

export function mapSubmissionToIndexEntry(sub: SubmissionWithRelations): IndexEntry {
  return {
    id: sub.id,
    title: sub.problem.title,
    difficulty: sub.problem.difficultyValue ?? 5,
    difficultyRating: sub.difficultyRating,
    tags: sub.tags,
    username: sub.user.fullName ?? sub.userId,
    userId: sub.userId,
    date: toISTDateString(sub.createdAt),
    timestamp: sub.createdAt.toISOString(),
    platform: sub.problem.platform as IndexEntry["platform"],
    difficultyLabel: sub.problem.difficultyLabel ?? undefined,
    rating: sub.problem.rating ?? undefined,
    problemSlug: sub.problemSlug,
  };
}