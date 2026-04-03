import { auth, currentUser } from "@clerk/nextjs/server";
import { NextResponse, NextRequest } from "next/server";
import prisma from "@/lib/prisma";

/**
 * GET /api/comments?submissionId=X
 * Public: Fetch all comments for a submission.
 */
export async function GET(req: NextRequest) {
  try {
    const submissionId = req.nextUrl.searchParams.get("submissionId");

    if (!submissionId) {
      return NextResponse.json({ error: "submissionId is required" }, { status: 400 });
    }

    const comments = await prisma.comment.findMany({
      where: { submissionId },
      include: {
        user: {
          select: { id: true, fullName: true },
        },
      },
      orderBy: { createdAt: "asc" },
    });

    const mapped = comments.map((c) => ({
      id: c.id,
      content: c.content,
      createdAt: c.createdAt.toISOString(),
      userId: c.userId,
      username: c.user.fullName ?? c.userId,
    }));

    return NextResponse.json({ success: true, data: mapped });
  } catch (error: unknown) {
    console.error("GET /api/comments error:", error);
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}

/**
 * POST /api/comments
 * Authenticated: Create a new comment.
 * Body: { submissionId, content }
 */
export async function POST(req: Request) {
  try {
    const { userId } = await auth();
    const user = await currentUser();

    if (!userId || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { submissionId, content } = body;

    if (!submissionId || !content) {
      return NextResponse.json({ error: "submissionId and content are required" }, { status: 400 });
    }

    // Validate content length
    if (content.length < 1 || content.length > 2000) {
      return NextResponse.json({ error: "Comment must be 1-2000 characters" }, { status: 400 });
    }

    // Verify the submission exists
    const submission = await prisma.submission.findUnique({
      where: { id: submissionId },
      select: { id: true },
    });

    if (!submission) {
      return NextResponse.json({ error: "Submission not found" }, { status: 404 });
    }

    // Ensure user exists in SQL
    const fullName = `${user.firstName} ${user.lastName || ""}`.trim();
    await prisma.user.upsert({
      where: { id: userId },
      update: { fullName },
      create: {
        id: userId,
        email: user.emailAddresses[0]?.emailAddress ?? `${userId}@clerk.user`,
        fullName,
      },
    });

    // Create the comment
    const comment = await prisma.comment.create({
      data: {
        content,
        userId,
        submissionId,
      },
      include: {
        user: { select: { id: true, fullName: true } },
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        id: comment.id,
        content: comment.content,
        createdAt: comment.createdAt.toISOString(),
        userId: comment.userId,
        username: comment.user.fullName ?? comment.userId,
      },
    });
  } catch (error: unknown) {
    console.error("POST /api/comments error:", error);
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}

/**
 * PUT /api/comments
 * Authenticated: Edit your own comment.
 * Body: { commentId, content }
 */
export async function PUT(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { commentId, content } = body;

    if (!commentId || !content) {
      return NextResponse.json({ error: "commentId and content are required" }, { status: 400 });
    }

    if (content.length < 1 || content.length > 2000) {
      return NextResponse.json({ error: "Comment must be 1-2000 characters" }, { status: 400 });
    }

    // Fetch existing comment
    const existing = await prisma.comment.findUnique({
      where: { id: commentId },
    });

    if (!existing) {
      return NextResponse.json({ error: "Comment not found" }, { status: 404 });
    }

    // Ownership check
    if (existing.userId !== userId) {
      return NextResponse.json({ error: "Forbidden: You can only edit your own comments" }, { status: 403 });
    }

    const updated = await prisma.comment.update({
      where: { id: commentId },
      data: { content },
      include: {
        user: { select: { id: true, fullName: true } },
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        id: updated.id,
        content: updated.content,
        createdAt: updated.createdAt.toISOString(),
        userId: updated.userId,
        username: updated.user.fullName ?? updated.userId,
      },
    });
  } catch (error: unknown) {
    console.error("PUT /api/comments error:", error);
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
