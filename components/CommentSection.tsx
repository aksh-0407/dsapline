"use client";

import { useState, useEffect, useCallback } from "react";
import { useUser } from "@clerk/nextjs";
import { formatISTDateTime } from "@/lib/date";
import {
  MessageSquare, Send, Loader2, Pencil, X, Check, Trash2,
  Code2, ChevronDown, ChevronUp, Copy
} from "lucide-react";

// Languages for the code block language selector
const CODE_LANGUAGES = [
  "cpp", "python", "java", "javascript", "typescript",
  "c", "go", "rust", "kotlin", "swift", "sql", "other",
];

interface Comment {
  id: string;
  content: string;
  codeSnippet: string | null;
  codeLanguage: string | null;
  createdAt: string;
  userId: string;
  username: string;
}

interface CommentSectionProps {
  submissionId: string;
}

export function CommentSection({ submissionId }: CommentSectionProps) {
  const { user, isSignedIn } = useUser();

  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [newComment, setNewComment] = useState("");
  const [newCodeSnippet, setNewCodeSnippet] = useState("");
  const [newCodeLanguage, setNewCodeLanguage] = useState("cpp");
  const [showNewCodeBlock, setShowNewCodeBlock] = useState(false);
  const [posting, setPosting] = useState(false);
  const [postError, setPostError] = useState<string | null>(null);

  // Edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");
  const [editCodeSnippet, setEditCodeSnippet] = useState("");
  const [editCodeLanguage, setEditCodeLanguage] = useState("cpp");
  const [showEditCodeBlock, setShowEditCodeBlock] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);

  // Delete state
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // Fetch comments — memoised so it's safe as a useEffect dependency
  const fetchComments = useCallback(async () => {
    try {
      const res = await fetch(`/api/comments?submissionId=${submissionId}`);
      const data = await res.json();
      if (data.success) {
        setComments(data.data);
      }
    } catch (err) {
      console.error("Failed to fetch comments:", err);
    } finally {
      setLoading(false);
    }
  }, [submissionId]);

  useEffect(() => {
    fetchComments();
  }, [fetchComments]);

  // Post a new comment
  const handlePost = async () => {
    if (!newComment.trim()) return;
    setPosting(true);
    setPostError(null);

    try {
      const res = await fetch("/api/comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          submissionId,
          content: newComment.trim(),
          codeSnippet: showNewCodeBlock && newCodeSnippet.trim() ? newCodeSnippet.trim() : null,
          codeLanguage: showNewCodeBlock && newCodeSnippet.trim() ? newCodeLanguage : null,
        }),
      });

      const data = await res.json();

      if (data.success) {
        setComments((prev) => [...prev, data.data]);
        setNewComment("");
        setNewCodeSnippet("");
        setShowNewCodeBlock(false);
      } else {
        setPostError(data.error || "Failed to post comment");
      }
    } catch (err) {
      console.error("Failed to post comment:", err);
      setPostError("Network error. Please try again.");
    } finally {
      setPosting(false);
    }
  };

  // Start editing a comment
  const startEdit = (comment: Comment) => {
    setEditingId(comment.id);
    setEditContent(comment.content);
    setEditCodeSnippet(comment.codeSnippet ?? "");
    setEditCodeLanguage(comment.codeLanguage ?? "cpp");
    setShowEditCodeBlock(!!comment.codeSnippet);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditContent("");
    setEditCodeSnippet("");
    setShowEditCodeBlock(false);
  };

  // Save edited comment
  const saveEdit = async () => {
    if (!editContent.trim() || !editingId) return;
    setSavingEdit(true);

    try {
      const res = await fetch("/api/comments", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          commentId: editingId,
          content: editContent.trim(),
          codeSnippet: showEditCodeBlock && editCodeSnippet.trim() ? editCodeSnippet.trim() : null,
          codeLanguage: showEditCodeBlock && editCodeSnippet.trim() ? editCodeLanguage : null,
        }),
      });

      const data = await res.json();

      if (data.success) {
        setComments((prev) => prev.map((c) => (c.id === editingId ? data.data : c)));
        cancelEdit();
      } else {
        console.error(data.error);
      }
    } catch (err) {
      console.error("Failed to update comment:", err);
    } finally {
      setSavingEdit(false);
    }
  };

  // Delete a comment (two-step confirm)
  const handleDelete = async (commentId: string) => {
    if (confirmDeleteId !== commentId) {
      // First click — show confirm state
      setConfirmDeleteId(commentId);
      return;
    }

    // Second click — proceed with deletion
    setDeletingId(commentId);
    try {
      const res = await fetch("/api/comments", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ commentId }),
      });
      const data = await res.json();
      if (data.success) {
        setComments((prev) => prev.filter((c) => c.id !== commentId));
      }
    } catch (err) {
      console.error("Failed to delete comment:", err);
    } finally {
      setDeletingId(null);
      setConfirmDeleteId(null);
    }
  };

  // Copy code snippet to clipboard
  const copyCode = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
    } catch {
      // Fallback for insecure contexts
    }
  };

  // Handle Enter key in textarea (Shift+Enter for newline)
  const handleKeyDown = (e: React.KeyboardEvent, action: () => void) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      action();
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <h2 className="text-xl font-bold flex items-center gap-2 text-white">
        <MessageSquare className="text-blue-400" size={20} />
        Discussion
        {comments.length > 0 && (
          <span className="text-sm font-normal text-gray-500 ml-1">
            ({comments.length})
          </span>
        )}
      </h2>

      {/* Comment List */}
      {loading ? (
        <div className="flex items-center justify-center py-8 text-gray-500">
          <Loader2 size={20} className="animate-spin mr-2" />
          Loading comments...
        </div>
      ) : comments.length === 0 ? (
        <div className="text-center py-8 bg-gray-900/30 rounded-xl border border-gray-800/50">
          <MessageSquare size={32} className="mx-auto text-gray-700 mb-2" />
          <p className="text-gray-500 text-sm">No comments yet. Start the discussion!</p>
        </div>
      ) : (
        <div className="space-y-3">
          {comments.map((comment) => {
            const isMyComment = user?.id === comment.userId;
            const isEditing = editingId === comment.id;
            const isConfirmDelete = confirmDeleteId === comment.id;
            const isDeleting = deletingId === comment.id;

            return (
              <div
                key={comment.id}
                className={`bg-gray-900/50 border rounded-lg overflow-hidden transition-colors ${
                  isMyComment ? "border-blue-900/30" : "border-gray-800"
                }`}
              >
                {/* Comment Header */}
                <div className="flex items-center justify-between p-4 pb-2">
                  <div className="flex items-center gap-2">
                    <div
                      className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                        isMyComment
                          ? "bg-blue-900/40 text-blue-400"
                          : "bg-gray-800 text-gray-400"
                      }`}
                    >
                      {comment.username.charAt(0).toUpperCase()}
                    </div>
                    <span className={`text-sm font-medium ${isMyComment ? "text-blue-400" : "text-gray-300"}`}>
                      {comment.username}
                      {isMyComment && (
                        <span className="text-[10px] text-blue-500 ml-1">(you)</span>
                      )}
                    </span>
                    <span className="text-[10px] text-gray-600">
                      {formatISTDateTime(comment.createdAt)}
                    </span>
                  </div>

                  {/* Edit + Delete (own comments only) */}
                  {isMyComment && !isEditing && (
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => startEdit(comment)}
                        className="text-gray-600 hover:text-gray-300 transition p-1.5 rounded hover:bg-gray-800"
                        title="Edit comment"
                      >
                        <Pencil size={12} />
                      </button>

                      {/* Two-step delete: first click shows confirm, second deletes */}
                      <button
                        onClick={() => handleDelete(comment.id)}
                        disabled={isDeleting}
                        className={`p-1.5 rounded transition ${
                          isConfirmDelete
                            ? "bg-red-900/30 text-red-400 hover:bg-red-900/50"
                            : "text-gray-600 hover:text-red-400 hover:bg-gray-800"
                        }`}
                        title={isConfirmDelete ? "Click again to confirm delete" : "Delete comment"}
                      >
                        {isDeleting
                          ? <Loader2 size={12} className="animate-spin" />
                          : <Trash2 size={12} />
                        }
                      </button>

                      {isConfirmDelete && (
                        <button
                          onClick={() => setConfirmDeleteId(null)}
                          className="text-gray-600 hover:text-gray-300 p-1.5 rounded hover:bg-gray-800 transition"
                          title="Cancel delete"
                        >
                          <X size={12} />
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {/* Comment Body */}
                <div className="px-4 pb-4">
                  {isEditing ? (
                    <EditCommentComposer
                      content={editContent}
                      setContent={setEditContent}
                      codeSnippet={editCodeSnippet}
                      setCodeSnippet={setEditCodeSnippet}
                      codeLanguage={editCodeLanguage}
                      setCodeLanguage={setEditCodeLanguage}
                      showCodeBlock={showEditCodeBlock}
                      setShowCodeBlock={setShowEditCodeBlock}
                      onSave={saveEdit}
                      onCancel={cancelEdit}
                      isSaving={savingEdit}
                    />
                  ) : (
                    <>
                      <p className="text-sm text-gray-300 leading-relaxed whitespace-pre-wrap">
                        {comment.content}
                      </p>

                      {/* Code block — visually distinct from prose */}
                      {comment.codeSnippet && (
                        <div className="mt-3 rounded-lg overflow-hidden border border-gray-700">
                          <div className="flex items-center justify-between px-3 py-1.5 bg-gray-900 border-b border-gray-700">
                            <div className="flex items-center gap-2">
                              <Code2 size={12} className="text-blue-400" />
                              <span className="text-[10px] font-mono text-gray-400 uppercase">
                                {comment.codeLanguage || "code"}
                              </span>
                            </div>
                            <button
                              onClick={() => copyCode(comment.codeSnippet!)}
                              className="text-gray-500 hover:text-gray-300 transition flex items-center gap-1 text-[10px]"
                              title="Copy code"
                            >
                              <Copy size={10} /> Copy
                            </button>
                          </div>
                          <div className="bg-black p-3 overflow-x-auto">
                            <pre className="font-mono text-xs text-emerald-400 leading-relaxed">
                              <code>{comment.codeSnippet}</code>
                            </pre>
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* New Comment Input */}
      {isSignedIn ? (
        <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-4 space-y-3">
          {/* Prose textarea */}
          <textarea
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            onKeyDown={(e) => handleKeyDown(e, handlePost)}
            rows={3}
            placeholder="Share your thoughts on this solution..."
            className="w-full p-3 bg-gray-950 border border-gray-800 rounded-lg text-sm text-gray-300 placeholder-gray-600 focus:ring-1 focus:ring-blue-600 outline-none resize-y"
            maxLength={2000}
          />

          {/* Code block toggle */}
          <button
            type="button"
            onClick={() => setShowNewCodeBlock((v) => !v)}
            className={`flex items-center gap-1.5 text-xs transition px-2.5 py-1 rounded border ${
              showNewCodeBlock
                ? "text-blue-400 border-blue-800 bg-blue-900/20"
                : "text-gray-500 border-gray-700 hover:border-gray-600 hover:text-gray-300"
            }`}
          >
            <Code2 size={12} />
            {showNewCodeBlock ? "Remove code block" : "Add code block"}
            {showNewCodeBlock ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
          </button>

          {/* Code composer (when toggled on) */}
          {showNewCodeBlock && (
            <CodeComposer
              codeSnippet={newCodeSnippet}
              setCodeSnippet={setNewCodeSnippet}
              codeLanguage={newCodeLanguage}
              setCodeLanguage={setNewCodeLanguage}
            />
          )}

          {/* Error message */}
          {postError && (
            <p className="text-xs text-red-400 flex items-center gap-1">
              <X size={10} /> {postError}
            </p>
          )}

          <div className="flex items-center justify-between">
            <span className="text-[10px] text-gray-600">
              {newComment.length}/2000 · Enter to send · Shift+Enter for newline
            </span>
            <button
              onClick={handlePost}
              disabled={posting || !newComment.trim()}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-500 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {posting ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
              {posting ? "Posting..." : "Comment"}
            </button>
          </div>
        </div>
      ) : (
        <div className="text-center py-6 bg-gray-900/30 rounded-xl border border-gray-800/50">
          <p className="text-gray-500 text-sm">
            Sign in to join the discussion.
          </p>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// CodeComposer — shared textarea + language selector for new comments
// ---------------------------------------------------------------------------
function CodeComposer({
  codeSnippet,
  setCodeSnippet,
  codeLanguage,
  setCodeLanguage,
}: {
  codeSnippet: string;
  setCodeSnippet: (v: string) => void;
  codeLanguage: string;
  setCodeLanguage: (v: string) => void;
}) {
  return (
    <div className="rounded-lg overflow-hidden border border-gray-700">
      {/* Toolbar: language selector */}
      <div className="flex items-center gap-2 px-3 py-2 bg-gray-900 border-b border-gray-700">
        <Code2 size={13} className="text-blue-400" />
        <select
          value={codeLanguage}
          onChange={(e) => setCodeLanguage(e.target.value)}
          className="bg-gray-800 text-gray-300 text-xs rounded px-2 py-0.5 border border-gray-700 focus:ring-1 focus:ring-blue-600 outline-none cursor-pointer"
        >
          {CODE_LANGUAGES.map((lang) => (
            <option key={lang} value={lang}>{lang}</option>
          ))}
        </select>
        <span className="text-[10px] text-gray-600 ml-auto">
          {codeSnippet.length}/10000
        </span>
      </div>
      <textarea
        value={codeSnippet}
        onChange={(e) => setCodeSnippet(e.target.value)}
        rows={8}
        placeholder="// Paste your code here..."
        className="w-full p-3 bg-black font-mono text-xs text-emerald-400 placeholder-gray-700 outline-none resize-y"
        maxLength={10000}
        spellCheck={false}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// EditCommentComposer — inline editor with optional code block
// ---------------------------------------------------------------------------
function EditCommentComposer({
  content,
  setContent,
  codeSnippet,
  setCodeSnippet,
  codeLanguage,
  setCodeLanguage,
  showCodeBlock,
  setShowCodeBlock,
  onSave,
  onCancel,
  isSaving,
}: {
  content: string;
  setContent: (v: string) => void;
  codeSnippet: string;
  setCodeSnippet: (v: string) => void;
  codeLanguage: string;
  setCodeLanguage: (v: string) => void;
  showCodeBlock: boolean;
  setShowCodeBlock: (v: boolean) => void;
  onSave: () => void;
  onCancel: () => void;
  isSaving: boolean;
}) {
  return (
    <div className="space-y-2">
      {/* Prose editor */}
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        rows={3}
        className="w-full p-3 bg-gray-950 border border-gray-700 rounded-lg text-sm text-gray-300 focus:ring-1 focus:ring-blue-600 outline-none resize-y"
        maxLength={2000}
        autoFocus
      />

      {/* Code block toggle */}
      <button
        type="button"
        onClick={() => setShowCodeBlock(!showCodeBlock)}
        className={`flex items-center gap-1 text-xs px-2 py-1 rounded border transition ${
          showCodeBlock
            ? "text-blue-400 border-blue-800 bg-blue-900/20"
            : "text-gray-500 border-gray-700 hover:border-gray-500"
        }`}
      >
        <Code2 size={11} />
        {showCodeBlock ? "Remove code block" : "Add code block"}
      </button>

      {showCodeBlock && (
        <CodeComposer
          codeSnippet={codeSnippet}
          setCodeSnippet={setCodeSnippet}
          codeLanguage={codeLanguage}
          setCodeLanguage={setCodeLanguage}
        />
      )}

      <div className="flex items-center gap-2 justify-end">
        <button
          onClick={onCancel}
          className="flex items-center gap-1 px-2.5 py-1 rounded text-xs text-gray-400 hover:text-white bg-gray-800 hover:bg-gray-700 transition"
        >
          <X size={12} /> Cancel
        </button>
        <button
          onClick={onSave}
          disabled={isSaving || !content.trim()}
          className="flex items-center gap-1 px-3 py-1 rounded text-xs text-white bg-blue-600 hover:bg-blue-500 transition disabled:opacity-50"
        >
          {isSaving ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
          Save
        </button>
      </div>
    </div>
  );
}
