/**
 * lib/problem-stats.ts
 *
 * Single source of truth for recomputing a problem's community-average
 * difficulty. Previously this logic was duplicated in app/api/submit/route.ts
 * and app/api/submission/[id]/route.ts, and it only ever *wrote* a non-null
 * average — so removing the last rating left a stale value behind.
 *
 * The average is taken over SolvedProblem rows (one data point per user) so a
 * user with several alternate solutions still counts exactly once.
 */
import { Prisma } from "@prisma/client";

/**
 * Recompute Problem.difficultyValue as AVG(SolvedProblem.difficultyRating)
 * across all users who rated the problem. Writes `null` when no ratings
 * remain, so the displayed difficulty resets correctly.
 *
 * Accepts either the base client or a transaction client.
 */
export async function recomputeProblemAvgDifficulty(
  client: Prisma.TransactionClient,
  problemSlug: string
): Promise<void> {
  const agg = await client.solvedProblem.aggregate({
    where: { problemSlug, difficultyRating: { not: null } },
    _avg: { difficultyRating: true },
  });

  await client.problem.update({
    where: { slug: problemSlug },
    data: { difficultyValue: agg._avg.difficultyRating },
  });
}
