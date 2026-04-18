import { notFound } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import prisma from "@/lib/prisma";
import { formatISTDate } from "@/lib/date";
import { ArrowLeft, Calendar, Tag, ExternalLink, Code2, FileText, User, Star, Users } from "lucide-react";
import Link from "next/link";
import { EditSubmission } from "@/components/EditSubmission";
import { CommentSection } from "@/components/CommentSection";

interface Props {
  params: Promise<{ id: string }>;
}

export const dynamic = "force-dynamic";

export default async function SubmissionPage({ params }: Props) {
  // 1. AWAIT PARAMS
  const { id } = await params;
  const { userId: currentUserId } = await auth();

  // 2. Fetch submission with relations + counts
  const sub = await prisma.submission.findUnique({
    where: { id },
    include: {
      problem: true,
      user: true,
      _count: { select: { comments: true, history: true } },
    },
  });

  if (!sub) {
    return notFound();
  }

  // 3. Determine ownership
  const isOwner = currentUserId === sub.userId;

  // 4. Difficulty display helpers
  const communityAvg = sub.problem.difficultyValue;
  const myRating = sub.difficultyRating;

  const difficultyColorClass = (val: number) =>
    val >= 8
      ? "bg-red-900/20 text-red-400 border-red-900/50"
      : val >= 5
      ? "bg-yellow-900/20 text-yellow-400 border-yellow-900/50"
      : "bg-green-900/20 text-green-400 border-green-900/50";

  return (
    <main className="min-h-screen bg-gray-950 text-white p-6 md:p-12">
      <div className="max-w-4xl mx-auto space-y-8">

        {/* Navigation */}
        <Link href="/archive" className="inline-flex items-center text-gray-400 hover:text-white transition-colors gap-2 text-sm group">
          <ArrowLeft size={16} className="group-hover:-translate-x-1 transition-transform" /> Back to Archive
        </Link>

        {/* Header Section */}
        <div className="border-b border-gray-800 pb-8 space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
              {sub.problem.title}
            </h1>

            {/* Metadata Badges */}
            <div className="flex flex-wrap items-center gap-3">
              {/* Community Average Difficulty */}
              {communityAvg !== null && (
                <span
                  className={`px-3 py-1 rounded-full text-sm font-bold border flex items-center gap-1.5 ${difficultyColorClass(communityAvg)}`}
                  title="Community average difficulty across all solutions"
                >
                  <Users size={12} />
                  Avg {communityAvg.toFixed(1)}
                </span>
              )}

              {/* My Personal Rating */}
              {myRating !== null ? (
                <span
                  className={`px-3 py-1 rounded-full text-sm font-bold border flex items-center gap-1.5 ${difficultyColorClass(myRating)}`}
                  title="Your personal difficulty rating for this submission"
                >
                  <Star size={12} />
                  My Rating {myRating.toFixed(1)}
                </span>
              ) : (
                <span className="px-3 py-1 rounded-full text-sm border bg-gray-900 text-gray-500 border-gray-700">
                  Unrated
                </span>
              )}

              {/* Platform label (Easy / Medium / Hard for LeetCode) */}
              {sub.problem.difficultyLabel && (
                <span className="px-3 py-1 rounded-full text-sm font-bold border bg-gray-900 text-gray-300 border-gray-700">
                  {sub.problem.difficultyLabel}
                </span>
              )}

              {sub.problem.url && (
                <a
                  href={sub.problem.url}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1.5 px-3 py-1 rounded-full text-sm bg-gray-900 border border-gray-700 hover:bg-gray-800 transition-colors"
                >
                  Problem Link <ExternalLink size={12} />
                </a>
              )}

              {/* Problem Page Link */}
              <Link
                href={`/problem/${sub.problemSlug}`}
                className="flex items-center gap-1.5 px-3 py-1 rounded-full text-sm bg-purple-900/20 text-purple-400 border border-purple-900/50 hover:bg-purple-900/30 transition-colors"
              >
                All Solutions
              </Link>
            </div>
          </div>

          {/* Sub-Header info */}
          <div className="flex flex-wrap gap-6 text-sm text-gray-400">
            <div className="flex items-center gap-2">
              <User size={16} className="text-blue-500" />
              <span>Solved by <Link
                href={`/user/${sub.userId}`}
                className="text-white font-medium hover:underline ml-1"
              >{sub.user.fullName ?? sub.userId}</Link></span>
            </div>
            <div className="flex items-center gap-2">
              <Calendar size={16} className="text-purple-500" />
              <span>{formatISTDate(sub.createdAt)}</span>
            </div>
            <div className="flex items-center gap-2">
              <Code2 size={16} className="text-emerald-500" />
              <span className="uppercase font-mono text-xs">{sub.language}</span>
            </div>
          </div>

          {/* Tags */}
          <div className="flex flex-wrap gap-2">
            {sub.tags.map((tag) => (
              <span key={tag} className="flex items-center gap-1 px-2 py-1 rounded text-xs bg-gray-900 text-gray-300 border border-gray-800">
                <Tag size={10} /> {tag}
              </span>
            ))}
          </div>
        </div>

        {/* Edit Controls (Only visible to owner) */}
        <EditSubmission
          submissionId={sub.id}
          isOwner={isOwner}
          initialCode={sub.codeSnippet}
          initialNotes={sub.notes ?? ""}
          initialTags={sub.tags}
          initialLanguage={sub.language}
          initialTitle={sub.title}
          initialDifficultyRating={sub.difficultyRating}
          communityAvgDifficulty={communityAvg}
          editCount={sub._count.history}
        />

        {/* Main Solution */}
        <div className="space-y-4">
          <h2 className="text-xl font-bold flex items-center gap-2 text-white">
            <Code2 className="text-blue-400" /> Solution
          </h2>
          <div className="relative group">
            {/* Glow Effect */}
            <div className="absolute -inset-0.5 bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg opacity-20 group-hover:opacity-40 transition duration-500 blur"></div>
            <div className="relative bg-black rounded-lg border border-gray-800 p-6 overflow-x-auto">
              <pre className="font-mono text-sm text-gray-300 leading-relaxed">
                <code>{sub.codeSnippet || "// Code content not found or failed to load."}</code>
              </pre>
            </div>
          </div>
        </div>

        {/* Notes */}
        {sub.notes && (
          <div className="space-y-4">
            <h2 className="text-xl font-bold flex items-center gap-2 text-white">
              <FileText className="text-yellow-400" /> Notes
            </h2>
            <div className="bg-gray-900/50 rounded-xl border border-gray-800 p-6 text-gray-300 leading-7 whitespace-pre-wrap">
              {sub.notes}
            </div>
          </div>
        )}

        {/* Discussion Section */}
        <CommentSection submissionId={sub.id} />

      </div>
    </main>
  );
}