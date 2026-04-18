import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { enrichProblemData } from "@/lib/services";
import { titleToSlug } from "@/lib/utils";
import prisma from "@/lib/prisma";

export async function POST(req: Request) {
  try {
    const { url } = await req.json();
    if (!url) return NextResponse.json({ error: "Missing URL" }, { status: 400 });

    // Run enrichment in parallel with auth check
    const [enriched, { userId }] = await Promise.all([
      enrichProblemData(url),
      auth(),
    ]);

    // --- Check if authenticated user has already solved this problem ---
    let existingSolve = null;
    if (userId && enriched?.realTitle) {
      // Use shared titleToSlug — guaranteed to match the slug produced by submit/route.ts
      const problemSlug = titleToSlug(enriched.realTitle);

      const sp = await prisma.solvedProblem.findUnique({
        where: {
          userId_problemSlug: { userId, problemSlug },
        },
        select: {
          id: true,
          firstSolvedAt: true,
          notes: true,
          tags: true,
          difficultyRating: true,
          problemSlug: true,
        },
      });

      if (sp) {
        existingSolve = {
          id: sp.id,
          firstSolvedAt: sp.firstSolvedAt.toISOString(),
          notes: sp.notes,
          tags: sp.tags,
          difficultyRating: sp.difficultyRating,
          problemSlug: sp.problemSlug,
        };
      }
    }

    if (!enriched && !existingSolve) {
      return NextResponse.json({ success: false });
    }

    return NextResponse.json({ success: true, data: enriched, existingSolve });
  } catch {
    return NextResponse.json({ error: "Failed to parse" }, { status: 500 });
  }
}