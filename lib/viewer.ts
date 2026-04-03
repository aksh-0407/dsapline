import prisma from "./prisma";

/**
 * Fetch a Problem record by slug with submission count.
 */
export async function getProblemBySlug(slug: string) {
  return prisma.problem.findUnique({
    where: { slug },
    include: {
      _count: { select: { submissions: true } },
    },
  });
}

/**
 * Fetch ALL submissions for a given problem slug.
 * Used by the /problem/[slug] page.
 */
export async function getSubmissionsByProblem(slug: string) {
  const submissions = await prisma.submission.findMany({
    where: { problemSlug: slug },
    include: {
      user: true,
      _count: { select: { comments: true, history: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return submissions.map((sub) => ({
    id: sub.id,
    userId: sub.userId,
    username: sub.user.fullName ?? sub.userId,
    language: sub.language,
    codeSnippet: sub.codeSnippet,
    notes: sub.notes,
    tags: sub.tags,
    status: sub.status,
    createdAt: sub.createdAt.toISOString(),
    updatedAt: sub.updatedAt.toISOString(),
    commentCount: sub._count.comments,
    editCount: sub._count.history,
  }));
}