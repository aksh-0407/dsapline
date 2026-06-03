import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

const PREDEFINED_TAGS = [
  "Array", "String", "Hash Table", "DP", "Math",
  "Two Pointers", "Binary Search", "Greedy", "Stack",
  "Graph", "Recursion", "Linked List", "Tree",
];

/**
 * GET /api/tags
 * Returns the union of all tags ever used across the platform, merged with
 * the built-in predefined tag list.  The SubmitForm calls this on mount so
 * that custom/community tags added by any user show up in the picker for
 * everyone.
 */
export async function GET() {
  try {
    // Collect tags from both tables in parallel
    const [solvedRows, submissionRows] = await Promise.all([
      prisma.solvedProblem.findMany({
        where: { tags: { isEmpty: false } },
        select: { tags: true },
      }),
      prisma.submission.findMany({
        where: { tags: { isEmpty: false } },
        select: { tags: true },
      }),
    ]);

    const tagSet = new Set<string>(PREDEFINED_TAGS);

    for (const row of [...solvedRows, ...submissionRows]) {
      for (const tag of row.tags) {
        if (tag && tag.trim()) {
          tagSet.add(tag.trim());
        }
      }
    }

    const allTags = Array.from(tagSet).sort((a, b) =>
      a.localeCompare(b, undefined, { sensitivity: "base" })
    );

    return NextResponse.json({ success: true, tags: allTags });
  } catch (error: unknown) {
    console.error("GET /api/tags error:", error);
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 500 }
    );
  }
}
