import prisma from "./prisma";
import { IndexEntry } from "./types";
import { toISTDateString } from "./date";
import { Prisma } from "@prisma/client";

type SubmissionWithRelations = Prisma.SubmissionGetPayload<{
  include: { problem: true; user: true };
}>;

function mapToIndexEntry(sub: SubmissionWithRelations): IndexEntry {
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

export async function getGlobalArchive(): Promise<IndexEntry[]> {
  const submissions = await prisma.submission.findMany({
    include: {
      problem: true,
      user: true,
    },
    orderBy: { createdAt: "desc" },
  });

  return submissions.map(mapToIndexEntry);
}

/**
 * Fetch submissions for a single user. Uses WHERE userId = ? at the DB level
 * instead of fetching all submissions and filtering in JS.
 */
export async function getUserArchive(userId: string): Promise<IndexEntry[]> {
  const submissions = await prisma.submission.findMany({
    where: { userId },
    include: {
      problem: true,
      user: true,
    },
    orderBy: { createdAt: "desc" },
  });

  return submissions.map(mapToIndexEntry);
}