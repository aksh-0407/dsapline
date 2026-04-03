"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatISTDateTime } from "@/lib/date";
import { Pencil, X, Save, Loader2, History, ChevronDown, ChevronUp, Tag } from "lucide-react";

interface EditSubmissionProps {
  submissionId: string;
  isOwner: boolean;
  initialCode: string;
  initialNotes: string;
  initialTags: string[];
  initialLanguage: string;
  /** The user's personal difficulty rating for this submission (null = unrated). */
  initialDifficultyRating: number | null;
  /** The community average difficulty for this problem (shown read-only for context). */
  communityAvgDifficulty: number | null;
  editCount: number;
}

interface HistoryEntry {
  id: string;
  oldCode: string;
  oldNotes: string | null;
  changedAt: string;
}

const PREDEFINED_TAGS = [
  "Array", "String", "Hash Table", "DP", "Math",
  "Two Pointers", "Binary Search", "Greedy", "Stack",
  "Graph", "Recursion", "Linked List", "Tree",
];

export function EditSubmission({
  submissionId,
  isOwner,
  initialCode,
  initialNotes,
  initialTags,
  initialLanguage,
  initialDifficultyRating,
  communityAvgDifficulty,
  editCount,
}: EditSubmissionProps) {
  const router = useRouter();

  // Edit mode state
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [code, setCode] = useState(initialCode);
  const [notes, setNotes] = useState(initialNotes);
  const [tags, setTags] = useState<string[]>(initialTags);
  const [language, setLanguage] = useState(initialLanguage);
  const [difficultyRating, setDifficultyRating] = useState<number>(initialDifficultyRating ?? 5);
  const [isUnrated, setIsUnrated] = useState(initialDifficultyRating === null);
  const [customTag, setCustomTag] = useState("");

  // History state
  const [showHistory, setShowHistory] = useState(false);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [expandedHistory, setExpandedHistory] = useState<string | null>(null);

  // --- Tag Management ---
  const toggleTag = (tag: string) => {
    setTags((prev) => (prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]));
  };

  const addCustomTag = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && customTag.trim()) {
      e.preventDefault();
      const val = customTag.trim();
      if (!tags.includes(val)) setTags((prev) => [...prev, val]);
      setCustomTag("");
    }
  };

  // --- Save Handler ---
  const handleSave = async () => {
    setIsSaving(true);
    setError(null);

    try {
      const res = await fetch(`/api/submission/${submissionId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          codeSnippet: code,
          notes,
          tags,
          language,
          difficultyRating: isUnrated ? null : difficultyRating,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to save changes");
      }

      setIsEditing(false);
      router.refresh();
    } catch (err: unknown) {
      setError((err as Error).message);
    } finally {
      setIsSaving(false);
    }
  };

  // --- Cancel Handler ---
  const handleCancel = () => {
    setCode(initialCode);
    setNotes(initialNotes);
    setTags(initialTags);
    setLanguage(initialLanguage);
    setDifficultyRating(initialDifficultyRating ?? 5);
    setIsUnrated(initialDifficultyRating === null);
    setError(null);
    setIsEditing(false);
  };

  // --- History Loader ---
  const loadHistory = async () => {
    if (history.length > 0) {
      setShowHistory(!showHistory);
      return;
    }
    setLoadingHistory(true);
    try {
      const res = await fetch(`/api/submission/${submissionId}/history`);
      const data = await res.json();
      if (data.success) setHistory(data.data);
    } catch (err) {
      console.error("Failed to load history:", err);
    } finally {
      setLoadingHistory(false);
      setShowHistory(true);
    }
  };

  // --- Read-Only View ---
  if (!isEditing) {
    return (
      <div className="space-y-4">
        {/* Action Buttons */}
        <div className="flex items-center gap-3 flex-wrap">
          {isOwner && (
            <button
              onClick={() => setIsEditing(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600/10 text-blue-400 border border-blue-900/50 hover:bg-blue-600/20 transition-all text-sm font-medium"
            >
              <Pencil size={14} />
              Edit Submission
            </button>
          )}

          {editCount > 0 && (
            <button
              onClick={loadHistory}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gray-800 text-gray-300 border border-gray-700 hover:bg-gray-700 transition-all text-sm font-medium"
            >
              {loadingHistory ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <History size={14} />
              )}
              {editCount} {editCount === 1 ? "Edit" : "Edits"}
              {showHistory ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>
          )}
        </div>

        {/* History Panel */}
        {showHistory && history.length > 0 && (
          <div className="space-y-3 animate-in slide-in-from-top-2">
            <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider">
              Edit History
            </h3>
            {history.map((entry) => (
              <div
                key={entry.id}
                className="bg-gray-900/50 border border-gray-800 rounded-lg overflow-hidden"
              >
                <button
                  onClick={() =>
                    setExpandedHistory(expandedHistory === entry.id ? null : entry.id)
                  }
                  className="w-full flex items-center justify-between p-4 text-left hover:bg-gray-800/50 transition"
                >
                  <div className="flex items-center gap-3">
                    <History size={14} className="text-gray-500" />
                    <span className="text-sm text-gray-300">
                      {formatISTDateTime(entry.changedAt)}
                    </span>
                  </div>
                  {expandedHistory === entry.id ? (
                    <ChevronUp size={14} className="text-gray-500" />
                  ) : (
                    <ChevronDown size={14} className="text-gray-500" />
                  )}
                </button>

                {expandedHistory === entry.id && (
                  <div className="border-t border-gray-800 p-4 space-y-3">
                    {entry.oldNotes && (
                      <div>
                        <div className="text-xs text-gray-500 uppercase mb-1">Previous Notes</div>
                        <div className="bg-gray-950 rounded p-3 text-sm text-gray-400 whitespace-pre-wrap">
                          {entry.oldNotes}
                        </div>
                      </div>
                    )}
                    <div>
                      <div className="text-xs text-gray-500 uppercase mb-1">Previous Code</div>
                      <div className="bg-black rounded p-3 overflow-x-auto">
                        <pre className="font-mono text-xs text-gray-400">
                          <code>{entry.oldCode}</code>
                        </pre>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // --- Edit Mode UI ---
  return (
    <div className="space-y-6 bg-gray-900/30 border border-blue-900/30 rounded-xl p-6 animate-in fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold text-blue-400 flex items-center gap-2">
          <Pencil size={18} />
          Editing Submission
        </h3>
        <div className="flex items-center gap-2">
          <button
            onClick={handleCancel}
            disabled={isSaving}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-800 text-gray-300 border border-gray-700 hover:bg-gray-700 transition text-sm"
          >
            <X size={14} />
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-blue-600 text-white hover:bg-blue-500 transition text-sm font-medium disabled:opacity-50"
          >
            {isSaving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            {isSaving ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-900/20 border border-red-900/50 text-red-400 px-4 py-2 rounded-lg text-sm">
          {error}
        </div>
      )}

      {/* Personal Difficulty Rating */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <label className="block text-sm font-bold text-gray-300">My Difficulty Rating</label>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="edit-unrated"
              checked={isUnrated}
              onChange={(e) => setIsUnrated(e.target.checked)}
              className="w-4 h-4 rounded border-gray-600 bg-gray-800 accent-blue-600"
            />
            <label htmlFor="edit-unrated" className="text-xs text-gray-400 cursor-pointer select-none">
              Unrated
            </label>
          </div>
        </div>
        {communityAvgDifficulty !== null && (
          <p className="text-xs text-gray-500 mb-3">
            Community average: <span className="text-gray-300 font-mono">{communityAvgDifficulty.toFixed(1)}</span>
          </p>
        )}
        <div className={`transition-opacity ${isUnrated ? "opacity-30 pointer-events-none" : "opacity-100"}`}>
          <div className="flex items-center gap-4">
            <span className="text-xs text-emerald-500 font-mono">Easy (0)</span>
            <input
              type="range"
              min="0"
              max="10"
              step="0.5"
              value={difficultyRating}
              onChange={(e) => setDifficultyRating(parseFloat(e.target.value))}
              className="flex-1 h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
            />
            <span className="text-xs text-red-500 font-mono">Hard (10)</span>
            <span
              className={`text-xl font-bold font-mono w-12 text-right ${
                difficultyRating >= 8
                  ? "text-red-500"
                  : difficultyRating >= 4
                  ? "text-blue-500"
                  : "text-emerald-500"
              }`}
            >
              {difficultyRating.toFixed(1)}
            </span>
          </div>
        </div>
      </div>

      {/* Language */}
      <div>
        <label className="block text-sm font-bold text-gray-300 mb-2">Language</label>
        <input
          type="text"
          value={language}
          onChange={(e) => setLanguage(e.target.value)}
          className="w-full max-w-xs p-2.5 bg-gray-950 border border-gray-800 rounded-lg text-sm text-white focus:ring-1 focus:ring-blue-600 outline-none"
          placeholder="cpp, python, java..."
        />
      </div>

      {/* Tags */}
      <div>
        <label className="block text-sm font-bold text-gray-300 mb-3">
          <Tag size={14} className="inline mr-1" />
          Tags
        </label>
        <div className="flex flex-wrap gap-2 mb-3">
          {tags.map((tag) => (
            <span
              key={tag}
              className="bg-blue-900/30 text-blue-300 border border-blue-800 px-3 py-1 rounded-full text-sm flex items-center gap-2"
            >
              {tag}
              <button type="button" onClick={() => toggleTag(tag)} className="hover:text-white">
                <X size={14} />
              </button>
            </span>
          ))}
          <input
            type="text"
            value={customTag}
            onChange={(e) => setCustomTag(e.target.value)}
            onKeyDown={addCustomTag}
            placeholder="+ New Tag (Enter)"
            className="bg-transparent border-b border-gray-700 text-sm p-1 focus:border-blue-500 outline-none text-gray-300 w-32 placeholder-gray-600"
          />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {PREDEFINED_TAGS.filter((t) => !tags.includes(t)).map((tag) => (
            <button
              key={tag}
              type="button"
              onClick={() => toggleTag(tag)}
              className="text-xs px-2.5 py-1 rounded-full border bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-500 transition"
            >
              {tag}
            </button>
          ))}
        </div>
      </div>

      {/* Code Editor */}
      <div>
        <label className="block text-sm font-bold text-gray-300 mb-2">Solution Code</label>
        <textarea
          value={code}
          onChange={(e) => setCode(e.target.value)}
          rows={16}
          className="w-full p-4 font-mono text-sm bg-black text-emerald-400 border border-gray-800 rounded-lg focus:ring-1 focus:ring-blue-500 outline-none resize-y"
        />
      </div>

      {/* Notes Editor */}
      <div>
        <label className="block text-sm font-bold text-gray-300 mb-2">Notes / Learnings</label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={4}
          className="w-full p-4 text-sm bg-gray-950 text-gray-300 border border-gray-800 rounded-lg focus:ring-1 focus:ring-blue-500 outline-none resize-y"
          placeholder="Key takeaways, approach used, etc."
        />
      </div>
    </div>
  );
}
