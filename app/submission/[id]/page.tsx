import { getSubmissionById } from "@/lib/viewer";
import { notFound } from "next/navigation";
import { ArrowLeft, Calendar, Tag, ExternalLink, Code2, FileText, User } from "lucide-react";
import Link from "next/link";

// CHANGED: params is now a Promise in Next.js 15
interface Props {
  params: Promise<{ id: string }>;
}

export const dynamic = "force-dynamic";

export default async function SubmissionPage({ params }: Props) {
  // 1. AWAIT PARAMS (Crucial Fix)
  const { id } = await params;
  
  const submission = await getSubmissionById(id);

  if (!submission) {
    return notFound();
  }

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
              {submission.question.title}
            </h1>
            
            {/* Metadata Badges */}
            <div className="flex flex-wrap items-center gap-3">
              <span className={`px-3 py-1 rounded-full text-sm font-bold border 
                ${submission.difficulty >= 8 ? "bg-red-900/20 text-red-400 border-red-900/50" : 
                  submission.difficulty >= 5 ? "bg-yellow-900/20 text-yellow-400 border-yellow-900/50" : 
                  "bg-green-900/20 text-green-400 border-green-900/50"}`}>
                Difficulty: {submission.difficulty}
              </span>
              <a 
                href={submission.question.url} 
                target="_blank" 
                rel="noreferrer"
                className="flex items-center gap-1.5 px-3 py-1 rounded-full text-sm bg-gray-900 border border-gray-700 hover:bg-gray-800 transition-colors"
              >
                Problem Link <ExternalLink size={12} />
              </a>
            </div>
          </div>

          {/* Sub-Header info */}
          <div className="flex flex-wrap gap-6 text-sm text-gray-400">
            <div className="flex items-center gap-2">
              <User size={16} className="text-blue-500" />
              <span>Solved by <Link 
                href={`/user/${submission.userId}`} 
                className="text-white font-medium hover:underline ml-1"
                >{submission.username}</Link></span>
            </div>
            <div className="flex items-center gap-2">
              <Calendar size={16} className="text-purple-500" />
              <span>{new Date(submission.timestamp).toLocaleDateString()}</span>
            </div>
          </div>

          {/* Tags */}
          <div className="flex flex-wrap gap-2">
            {submission.tags.map(tag => (
              <span key={tag} className="flex items-center gap-1 px-2 py-1 rounded text-xs bg-gray-900 text-gray-300 border border-gray-800">
                <Tag size={10} /> {tag}
              </span>
            ))}
          </div>
        </div>

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
                {/* @ts-ignore */}
                <code>{submission.mainSolution.code || "// Code content not found or failed to load."}</code>
              </pre>
            </div>
          </div>
        </div>

        {/* Alternate Solution (Optional) */}
        {submission.alternateSolution && (
          <div className="space-y-4">
            <h2 className="text-xl font-bold flex items-center gap-2 text-white">
              <Code2 className="text-purple-400" /> Alternate Approach
              <span className="text-sm font-normal text-gray-500 ml-2">({submission.alternateSolution.label})</span>
            </h2>
            <div className="bg-black rounded-lg border border-gray-800 p-6 overflow-x-auto">
              <pre className="font-mono text-sm text-gray-300 leading-relaxed">
                {/* @ts-ignore */}
                <code>{submission.alternateSolution.code || "// Code content not found."}</code>
              </pre>
            </div>
          </div>
        )}

        {/* Notes */}
        {submission.notes && (
          <div className="space-y-4">
            <h2 className="text-xl font-bold flex items-center gap-2 text-white">
              <FileText className="text-yellow-400" /> Notes
            </h2>
            <div className="bg-gray-900/50 rounded-xl border border-gray-800 p-6 text-gray-300 leading-7 whitespace-pre-wrap">
              {submission.notes}
            </div>
          </div>
        )}

      </div>
    </main>
  );
}