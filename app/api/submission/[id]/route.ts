import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * Recomputes and writes the community average difficulty for a problem.
 * Averages over SolvedProblem rows (one per user) so that alternate
 * solutions don't inflate a single user's weight in the community average.
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

/**
 * GET /api/submission/[id]
 * Public: Fetch a single submission with its relations.
 */
export async function GET(_req: Request, context: RouteContext) {
  try {
    const { id } = await context.params;

    const submission = await prisma.submission.findUnique({
      where: { id },
      include: {
        problem: true,
        user: true,
        _count: { select: { comments: true, history: true } },
      },
    });

    if (!submission) {
      return NextResponse.json({ error: "Submission not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: submission });
  } catch (error: unknown) {
    console.error("GET /api/submission/[id] error:", error);
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}

/**
 * PUT /api/submission/[id]
 * Authenticated: Edit a submission you own.
 * - Saves old code/notes to SubmissionHistory before overwriting.
 * - Allows editing: codeSnippet, notes, tags, language, difficultyRating.
 * - Recomputes Problem.difficultyValue (community avg) after updating difficultyRating.
 * - Does NOT allow editing the problem URL.
 */
export async function PUT(req: Request, context: RouteContext) {
  try {
    // 1. Auth check
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await context.params;

    // 2. Fetch the existing submission
    const existing = await prisma.submission.findUnique({
      where: { id },
      include: { problem: true },
    });

    if (!existing) {
      return NextResponse.json({ error: "Submission not found" }, { status: 404 });
    }

    // 3. Ownership check
    if (existing.userId !== userId) {
      return NextResponse.json(
        { error: "Forbidden: You can only edit your own submissions" },
        { status: 403 }
      );
    }

    // 4. Parse the update payload
    const body = await req.json();
    const {
      codeSnippet,
      notes,
      tags,
      language,
      title,            // Solution label/name (e.g. "Optimized O(log n)")
      difficultyRating, // Per-user difficulty on this submission (0-10 or null)
    } = body;

    // 5. Save the OLD version to SubmissionHistory (audit trail)
    await prisma.submissionHistory.create({
      data: {
        submissionId: existing.id,
        oldCode: existing.codeSnippet,
        oldNotes: existing.notes,
      },
    });

    // 6. Build the update payload (only include fields that were sent)
    const updateData: Record<string, unknown> = {};
    if (codeSnippet !== undefined) updateData.codeSnippet = codeSnippet;
    if (notes !== undefined) updateData.notes = notes || null;
    if (tags !== undefined) updateData.tags = tags;
    if (language !== undefined) updateData.language = language;
    if (title !== undefined) updateData.title = title || null;  // Allow clearing the label
    if (difficultyRating !== undefined) {
      // Accept 0-10 range or null (unrated)
      updateData.difficultyRating =
        difficultyRating !== null &&
        typeof difficultyRating === "number" &&
        difficultyRating >= 0 &&
        difficultyRating <= 10
          ? difficultyRating
          : null;
    }

    // 7. Update the Submission row
    const updated = await prisma.submission.update({
      where: { id },
      data: updateData,
      include: { problem: true, user: true },
    });

    // 8. Recompute community average difficulty on the Problem (if difficultyRating changed)
    if (difficultyRating !== undefined) {
      await recomputeProblemAvgDifficulty(existing.problemSlug);
    }

    return NextResponse.json({ success: true, data: updated });
  } catch (error: unknown) {
    console.error("PUT /api/submission/[id] error:", error);
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}

/**
 * DELETE /api/submission/[id]
 * Authenticated: Delete a submission you own.
 * - If this is the LAST submission for its SolvedProblem, the SolvedProblem
 *   row is deleted and user.totalSolved is decremented.
 * - If other submissions remain, the SolvedProblem is preserved unchanged.
 */
export async function DELETE(_req: Request, context: RouteContext) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await context.params;

    const existing = await prisma.submission.findUnique({
      where: { id },
      include: {
        solvedProblem: {
          include: {
            _count: { select: { submissions: true } },
          },
        },
      },
    });

    if (!existing) {
      return NextResponse.json({ error: "Submission not found" }, { status: 404 });
    }

    if (existing.userId !== userId) {
      return NextResponse.json(
        { error: "Forbidden: You can only delete your own submissions" },
        { status: 403 }
      );
    }

    const isLastSubmission = existing.solvedProblem._count.submissions === 1;

    if (isLastSubmission) {
      // Delete the SolvedProblem (cascades to this Submission automatically)
      await prisma.solvedProblem.delete({ where: { id: existing.solvedProblemId } });

      // Decrement totalSolved only if it's currently > 0 — prevents negative values
      // if the DB is in an inconsistent state (e.g. after a partial migration).
      await prisma.user.updateMany({
        where: { id: userId, totalSolved: { gt: 0 } },
        data: { totalSolved: { decrement: 1 } },
      });

      return NextResponse.json({
        success: true,
        message: "Submission and SolvedProblem deleted. totalSolved decremented.",
      });
    } else {
      // Other submissions remain — just delete this one
      await prisma.submission.delete({ where: { id } });

      return NextResponse.json({
        success: true,
        message: "Submission deleted. SolvedProblem retained (other solutions remain).",
      });
    }
  } catch (error: unknown) {
    console.error("DELETE /api/submission/[id] error:", error);
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
