import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/submission/[id]/history
 * Public: Fetch the edit history for a submission.
 * Returns all SubmissionHistory entries, newest first.
 */
export async function GET(_req: Request, context: RouteContext) {
  try {
    const { id } = await context.params;

    // Verify the submission exists
    const submission = await prisma.submission.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!submission) {
      return NextResponse.json({ error: "Submission not found" }, { status: 404 });
    }

    const history = await prisma.submissionHistory.findMany({
      where: { submissionId: id },
      orderBy: { changedAt: "desc" },
    });

    return NextResponse.json({ success: true, data: history });
  } catch (error: unknown) {
    console.error("GET /api/submission/[id]/history error:", error);
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
