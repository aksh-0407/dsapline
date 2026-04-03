import { notFound } from "next/navigation";
import { getProblemBySlug, getSubmissionsByProblem } from "@/lib/viewer";
import { formatISTDate } from "@/lib/date";
import { ArrowLeft, Code2, ExternalLink, Users, Calendar, MessageSquare, History, Tag } from "lucide-react";
import Link from "next/link";

interface Props {
  params: Promise<{ slug: string }>;
}

export const dynamic = "force-dynamic";

export default async function ProblemPage({ params }: Props) {
  const { slug } = await params;

  const problem = await getProblemBySlug(slug);
  if (!problem) {
    return notFound();
  }

  const submissions = await getSubmissionsByProblem(slug);

  // Difficulty color helper
  const diffColor = (val: number) =>
    val >= 8 ? "text-red-400" : val >= 5 ? "text-yellow-400" : "text-emerald-400";
  const diffBg = (val: number) =>
    val >= 8 ? "bg-red-900/20 border-red-900/50" : val >= 5 ? "bg-yellow-900/20 border-yellow-900/50" : "bg-emerald-900/20 border-emerald-900/50";

  return (
    <main className="min-h-screen bg-gray-950 text-white p-6 md:p-12">
      <div className="max-w-5xl mx-auto space-y-8">

        {/* Navigation */}
        <Link href="/archive" className="inline-flex items-center text-gray-400 hover:text-white transition-colors gap-2 text-sm group">
          <ArrowLeft size={16} className="group-hover:-translate-x-1 transition-transform" /> Back to Archive
        </Link>

        {/* Problem Header */}
        <div className="bg-gradient-to-br from-gray-900 to-black border border-gray-800 rounded-2xl p-8 md:p-10 space-y-6">

          {/* Title Row */}
          <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <span className={`capitalize px-2.5 py-1 rounded text-xs font-bold border
                  ${problem.platform === 'leetcode' ? 'bg-yellow-900/20 text-yellow-500 border-yellow-900/50' :
                    problem.platform === 'codeforces' ? 'bg-red-900/20 text-red-500 border-red-900/50' :
                      'bg-blue-900/20 text-blue-500 border-blue-900/50'}`}>
                  {problem.platform}
                </span>
                {problem.difficultyLabel && (
                  <span className="text-xs font-bold uppercase text-gray-400 tracking-wider">
                    {problem.difficultyLabel}
                  </span>
                )}
              </div>
              <h1 className="text-3xl md:text-4xl font-bold text-white">{problem.title}</h1>
            </div>

            <div className="flex items-center gap-3">
              {problem.difficultyValue !== null && (
                <span className={`px-4 py-2 rounded-xl text-lg font-bold font-mono border ${diffBg(problem.difficultyValue)}`}>
                  <span className={diffColor(problem.difficultyValue)}>
                    {problem.difficultyValue.toFixed(1)}
                  </span>
                  <span className="text-gray-500 text-xs ml-1">/10</span>
                </span>
              )}
              {problem.rating && (
                <span className="px-3 py-2 rounded-xl text-sm font-mono font-bold bg-red-900/20 text-red-400 border border-red-900/50">
                  Rating: {problem.rating}
                </span>
              )}
            </div>
          </div>

          {/* Meta Row */}
          <div className="flex flex-wrap items-center gap-4 text-sm text-gray-400">
            <div className="flex items-center gap-2">
              <Users size={16} className="text-blue-400" />
              <span>{submissions.length} {submissions.length === 1 ? "submission" : "submissions"}</span>
            </div>
            {problem.url && (
              <a
                href={problem.url}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-gray-800 border border-gray-700 hover:bg-gray-700 transition-colors"
              >
                Open Problem <ExternalLink size={12} />
              </a>
            )}
          </div>
        </div>

        {/* Submissions List */}
        <div className="space-y-6">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Code2 size={20} className="text-blue-400" />
            All Submissions
          </h2>

          {submissions.length === 0 ? (
            <div className="text-center py-16 bg-gray-900/30 rounded-xl border border-gray-800/50">
              <p className="text-gray-500 italic">No submissions for this problem yet.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {submissions.map((sub) => (
                <div
                  key={sub.id}
                  className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden hover:border-gray-700 transition-colors group"
                >
                  {/* Submission Header */}
                  <div className="flex items-center justify-between p-5">
                    <div className="flex items-center gap-4">
                      {/* Avatar */}
                      <div className="w-10 h-10 bg-gray-800 rounded-full flex items-center justify-center border border-gray-700 text-gray-400 font-bold">
                        {sub.username.charAt(0).toUpperCase()}
                      </div>

                      <div>
                        <Link
                          href={`/user/${sub.userId}`}
                          className="font-semibold text-white hover:text-blue-400 transition-colors"
                        >
                          {sub.username}
                        </Link>
                        <div className="flex items-center gap-3 text-xs text-gray-500 mt-0.5">
                          <span className="flex items-center gap-1">
                            <Calendar size={11} />
                            {formatISTDate(sub.createdAt)}
                          </span>
                          <span className="uppercase font-mono text-gray-600">{sub.language}</span>
                          {sub.commentCount > 0 && (
                            <span className="flex items-center gap-1 text-blue-400">
                              <MessageSquare size={11} />
                              {sub.commentCount}
                            </span>
                          )}
                          {sub.editCount > 0 && (
                            <span className="flex items-center gap-1 text-gray-500">
                              <History size={11} />
                              {sub.editCount} edits
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <Link
                      href={`/submission/${sub.id}`}
                      className="px-4 py-2 rounded-lg bg-blue-600/10 text-blue-400 border border-blue-900/50 hover:bg-blue-600/20 transition-all text-sm font-medium"
                    >
                      View Full
                    </Link>
                  </div>

                  {/* Tags */}
                  {sub.tags.length > 0 && (
                    <div className="px-5 pb-3 flex flex-wrap gap-1.5">
                      {sub.tags.map((tag) => (
                        <span
                          key={tag}
                          className="text-[10px] bg-gray-800 text-gray-400 px-2 py-0.5 rounded-full border border-gray-700 flex items-center gap-1"
                        >
                          <Tag size={8} /> {tag}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Code Preview (first 8 lines) */}
                  <div className="border-t border-gray-800 bg-black/50 p-5">
                    <pre className="font-mono text-xs text-gray-400 leading-relaxed overflow-x-auto max-h-48 overflow-y-hidden">
                      <code>
                        {sub.codeSnippet.split("\n").slice(0, 8).join("\n")}
                        {sub.codeSnippet.split("\n").length > 8 && "\n// ... (click 'View Full' to see complete code)"}
                      </code>
                    </pre>
                  </div>

                  {/* Notes Preview */}
                  {sub.notes && (
                    <div className="border-t border-gray-800 px-5 py-3">
                      <p className="text-xs text-gray-500 truncate">
                        📝 {sub.notes}
                      </p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </main>
  );
}
