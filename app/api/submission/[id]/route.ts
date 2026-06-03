import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { recomputeProblemAvgDifficulty } from "@/lib/problem-stats";
import { recomputeUserStreaks } from "@/lib/streaks";
import { revalidateAfterWrite } from "@/lib/cache";
import { revalidatePath } from "next/cache";

interface RouteContext {
  params: Promise<{ id: string }>;
}

/** Clamp a raw difficulty payload to a valid 0-10 rating or null (unrated). */
function normalizeRating(value: unknown): number | null {
  return typeof value === "number" && value >= 0 && value <= 10 ? value : null;
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
 * - Snapshots old code/notes to SubmissionHistory before overwriting.
 * - Allows editing: codeSnippet, notes, tags, language, title, difficultyRating.
 * - Propagates difficultyRating to the parent SolvedProblem and recomputes the
 *   community average (which can reset to null if the rating is cleared).
 * - All writes run in one transaction.
 */
export async function PUT(req: Request, context: RouteContext) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await context.params;

    const existing = await prisma.submission.findUnique({
      where: { id },
      include: { problem: true },
    });

    if (!existing) {
      return NextResponse.json({ error: "Submission not found" }, { status: 404 });
    }

    if (existing.userId !== userId) {
      return NextResponse.json(
        { error: "Forbidden: You can only edit your own submissions" },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { codeSnippet, notes, tags, language, title, difficultyRating } = body;

    // Build the update payload (only include fields that were sent).
    const updateData: Record<string, unknown> = {};
    if (codeSnippet !== undefined) updateData.codeSnippet = codeSnippet;
    if (notes !== undefined) updateData.notes = notes || null;
    if (tags !== undefined) updateData.tags = Array.isArray(tags) ? tags : [];
    if (language !== undefined) updateData.language = language;
    if (title !== undefined) updateData.title = title || null; // allow clearing the label
    if (difficultyRating !== undefined) {
      updateData.difficultyRating = normalizeRating(difficultyRating);
    }

    const updated = await prisma.$transaction(async (tx) => {
      // 1. Snapshot the OLD version (audit trail).
      await tx.submissionHistory.create({
        data: {
          submissionId: existing.id,
          oldCode: existing.codeSnippet,
          oldNotes: existing.notes,
        },
      });

      // 2. Update the Submission row.
      const row = await tx.submission.update({
        where: { id },
        data: updateData,
        include: { problem: true, user: true },
      });

      // 3. Keep the parent SolvedProblem rating + community average in sync.
      if (difficultyRating !== undefined) {
        await tx.solvedProblem.updateMany({
          where: { userId, problemSlug: existing.problemSlug },
          data: { difficultyRating: normalizeRating(difficultyRating) },
        });
        await recomputeProblemAvgDifficulty(tx, existing.problemSlug);
      }

      return row;
    });

    // Edits change tags/difficulty shown on the dashboard & archive.
    revalidateAfterWrite(userId);
    revalidatePath(`/submission/${id}`);
    revalidatePath(`/problem/${existing.problemSlug}`);

    return NextResponse.json({ success: true, data: updated });
  } catch (error: unknown) {
    console.error("PUT /api/submission/[id] error:", error);
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}

/**
 * DELETE /api/submission/[id]
 * Authenticated: Delete a submission you own.
 * - If this is the LAST submission for its SolvedProblem, the SolvedProblem row
 *   is deleted, user.totalSolved is decremented, and the problem average +
 *   user streaks are recomputed.
 * - If other submissions remain and the deleted one was the main solution, the
 *   oldest remaining submission is promoted to main so the problem keeps one.
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
          include: { _count: { select: { submissions: true } } },
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

    const message = await prisma.$transaction(async (tx) => {
      if (isLastSubmission) {
        // Deleting the SolvedProblem cascades to this last Submission.
        await tx.solvedProblem.delete({ where: { id: existing.solvedProblemId } });

        // Decrement only when > 0 — guards against a negative count.
        await tx.user.updateMany({
          where: { id: userId, totalSolved: { gt: 0 } },
          data: { totalSolved: { decrement: 1 } },
        });

        await recomputeProblemAvgDifficulty(tx, existing.problemSlug);
        await recomputeUserStreaks(tx, userId);

        return "Submission and SolvedProblem deleted. Stats recomputed.";
      }

      // Other submissions remain — just delete this one.
      await tx.submission.delete({ where: { id } });

      // If we removed the main solution, promote the oldest remaining one so
      // the problem still has a main (used for the archive "View" link).
      if (existing.isMainSolution) {
        const nextMain = await tx.submission.findFirst({
          where: { solvedProblemId: existing.solvedProblemId },
          orderBy: { createdAt: "asc" },
          select: { id: true },
        });
        if (nextMain) {
          await tx.submission.update({
            where: { id: nextMain.id },
            data: { isMainSolution: true },
          });
        }
      }

      // A submission (and possibly an active day) was removed.
      await recomputeUserStreaks(tx, userId);

      return "Submission deleted. SolvedProblem retained (other solutions remain).";
    });

    revalidateAfterWrite(userId);
    revalidatePath(`/problem/${existing.problemSlug}`);
    revalidatePath(`/user/${userId}`);

    return NextResponse.json({ success: true, message });
  } catch (error: unknown) {
    console.error("DELETE /api/submission/[id] error:", error);
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
