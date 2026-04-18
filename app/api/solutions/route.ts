import { NextResponse } from "next/server";
import { getSubmissionsForSolvedProblem } from "@/lib/archive";

/**
 * GET /api/solutions?solvedProblemId=<id>
 *
 * Returns all Submission rows for a given SolvedProblem.
 * Used by the Archive's expandable "N solutions" panel.
 * Public endpoint — no auth required for reading.
 */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const solvedProblemId = searchParams.get("solvedProblemId");

    if (!solvedProblemId) {
      return NextResponse.json({ error: "Missing solvedProblemId" }, { status: 400 });
    }

    const submissions = await getSubmissionsForSolvedProblem(solvedProblemId);

    return NextResponse.json({ success: true, data: submissions });
  } catch (error: unknown) {
    console.error("GET /api/solutions error:", error);
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
