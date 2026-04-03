"use client";

import { useState, useEffect, useCallback } from "react";
import { useUser } from "@clerk/nextjs";
import { formatISTDateTime } from "@/lib/date";
import { MessageSquare, Send, Loader2, Pencil, X, Check } from "lucide-react";

interface Comment {
  id: string;
  content: string;
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
  const [posting, setPosting] = useState(false);

  // Edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);

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

  // Fetch comments on mount and when submissionId changes
  useEffect(() => {
    fetchComments();
  }, [fetchComments]);


  // Post a new comment
  const handlePost = async () => {
    if (!newComment.trim()) return;

    setPosting(true);
    try {
      const res = await fetch("/api/comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          submissionId,
          content: newComment.trim(),
        }),
      });

      const data = await res.json();

      if (data.success) {
        // Optimistic add
        setComments((prev) => [...prev, data.data]);
        setNewComment("");
      } else {
        alert(data.error || "Failed to post comment");
      }
    } catch (err) {
      console.error("Failed to post comment:", err);
    } finally {
      setPosting(false);
    }
  };

  // Start editing a comment
  const startEdit = (comment: Comment) => {
    setEditingId(comment.id);
    setEditContent(comment.content);
  };

  // Cancel editing
  const cancelEdit = () => {
    setEditingId(null);
    setEditContent("");
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
        }),
      });

      const data = await res.json();

      if (data.success) {
        // Update in place
        setComments((prev) =>
          prev.map((c) => (c.id === editingId ? data.data : c))
        );
        setEditingId(null);
        setEditContent("");
      } else {
        alert(data.error || "Failed to update comment");
      }
    } catch (err) {
      console.error("Failed to update comment:", err);
    } finally {
      setSavingEdit(false);
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

            return (
              <div
                key={comment.id}
                className={`bg-gray-900/50 border rounded-lg p-4 transition-colors ${
                  isMyComment ? "border-blue-900/30" : "border-gray-800"
                }`}
              >
                {/* Comment Header */}
                <div className="flex items-center justify-between mb-2">
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

                  {/* Edit Button (own comments only) */}
                  {isMyComment && !isEditing && (
                    <button
                      onClick={() => startEdit(comment)}
                      className="text-gray-600 hover:text-gray-300 transition p-1 rounded hover:bg-gray-800"
                      title="Edit comment"
                    >
                      <Pencil size={12} />
                    </button>
                  )}
                </div>

                {/* Comment Content */}
                {isEditing ? (
                  <div className="space-y-2">
                    <textarea
                      value={editContent}
                      onChange={(e) => setEditContent(e.target.value)}
                      onKeyDown={(e) => handleKeyDown(e, saveEdit)}
                      rows={3}
                      className="w-full p-3 bg-gray-950 border border-gray-700 rounded-lg text-sm text-gray-300 focus:ring-1 focus:ring-blue-600 outline-none resize-y"
                      maxLength={2000}
                    />
                    <div className="flex items-center gap-2 justify-end">
                      <button
                        onClick={cancelEdit}
                        className="flex items-center gap-1 px-2.5 py-1 rounded text-xs text-gray-400 hover:text-white bg-gray-800 hover:bg-gray-700 transition"
                      >
                        <X size={12} /> Cancel
                      </button>
                      <button
                        onClick={saveEdit}
                        disabled={savingEdit || !editContent.trim()}
                        className="flex items-center gap-1 px-3 py-1 rounded text-xs text-white bg-blue-600 hover:bg-blue-500 transition disabled:opacity-50"
                      >
                        {savingEdit ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
                        Save
                      </button>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-gray-300 leading-relaxed whitespace-pre-wrap">
                    {comment.content}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* New Comment Input */}
      {isSignedIn ? (
        <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-4 space-y-3">
          <textarea
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            onKeyDown={(e) => handleKeyDown(e, handlePost)}
            rows={3}
            placeholder="Share your thoughts on this solution..."
            className="w-full p-3 bg-gray-950 border border-gray-800 rounded-lg text-sm text-gray-300 placeholder-gray-600 focus:ring-1 focus:ring-blue-600 outline-none resize-y"
            maxLength={2000}
          />
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-gray-600">
              {newComment.length}/2000 · Press Enter to send, Shift+Enter for newline
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
