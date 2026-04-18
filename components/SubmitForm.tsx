"use client";

import { useState, useRef, useEffect } from "react";
import { useUser } from "@clerk/nextjs";
import {
  Plus, X, Upload, AlertCircle, Loader2, Sparkles,
  ChevronDown, ChevronUp, Check, CheckCircle2
} from "lucide-react";
import { useRouter } from "next/navigation";

const PREDEFINED_TAGS = [
  "Array", "String", "Hash Table", "DP", "Math",
  "Two Pointers", "Binary Search", "Greedy", "Stack",
  "Graph", "Recursion", "Linked List", "Tree",
];

const MAX_ALT_SOLUTIONS = 10;

interface AltSolution {
  label: string;
  tab: "paste" | "file";
  code: string;
}

interface ExistingSolve {
  id: string;
  firstSolvedAt: string;   // ISO 8601
  notes: string | null;
  tags: string[];
  difficultyRating: number | null;
  problemSlug: string;
}

/** Returns a human-readable "N days ago" string from an ISO date. */
function daysAgoLabel(isoDate: string): string {
  const ms = Date.now() - new Date(isoDate).getTime();
  const days = Math.floor(ms / (1000 * 60 * 60 * 24));
  if (days === 0) return "today";
  if (days === 1) return "yesterday";
  return `${days} days ago`;
}

export function SubmitForm() {
  const { user } = useUser();
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loadingMeta, setLoadingMeta] = useState(false);
  const [inlineError, setInlineError] = useState<string | null>(null);

  // Debounce timer ref for URL auto-enrichment
  const enrichDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // --- FORM STATE ---
  const [url, setUrl] = useState("");
  const [activeTab, setActiveTab] = useState<"paste" | "file">("paste");

  const [difficulty, setDifficulty] = useState(5.0);
  const [isUnrated, setIsUnrated] = useState(false);

  // TAG STATE: allKnownTags = predefined + custom + auto-filled
  // Selected tags are shown as active (not hidden) in the lower pool.
  const [allKnownTags, setAllKnownTags] = useState<string[]>(PREDEFINED_TAGS);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [customTag, setCustomTag] = useState("");

  // Solution title (for re-submissions — labels the new solution approach)
  const [solutionTitle, setSolutionTitle] = useState("");

  // Alternate solutions — dynamic list, max MAX_ALT_SOLUTIONS
  const [altSolutions, setAltSolutions] = useState<AltSolution[]>([]);
  const [altFilesRef, setAltFilesRef] = useState<Record<number, File | null>>({});

  // RE-SUBMISSION STATE
  const [existingSolve, setExistingSolve] = useState<ExistingSolve | null>(null);

  // --- AUTO-FILL (on URL blur) ---
  const handleAutoFill = async () => {
    if (!url) return;
    setLoadingMeta(true);

    try {
      const res = await fetch("/api/parse-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const { success, data, existingSolve: existingSolveData } = await res.json();

      // Handle re-submission detection
      if (existingSolveData) {
        setExistingSolve(existingSolveData);

        // Auto-fill tags from the existing solve (merge into allKnownTags + select them)
        if (existingSolveData.tags?.length > 0) {
          const normalized: string[] = existingSolveData.tags.map((t: string) =>
            t.replace(/-/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase())
          );
          setAllKnownTags((prev) => {
            const merged = [...prev];
            normalized.forEach((t) => { if (!merged.includes(t)) merged.push(t); });
            return merged;
          });
          setSelectedTags((prev) => Array.from(new Set([...prev, ...normalized])));
        }

        // Auto-fill difficulty rating
        if (!isUnrated && existingSolveData.difficultyRating !== null) {
          setDifficulty(existingSolveData.difficultyRating);
        }
      } else {
        setExistingSolve(null);
      }

      // Also handle platform enrichment tags
      if (success && data?.tags && Array.isArray(data.tags)) {
        const formattedTags = data.tags.map((t: string) =>
          t.replace(/-/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase())
        );
        setAllKnownTags((prev) => {
          const merged = [...prev];
          formattedTags.forEach((t: string) => { if (!merged.includes(t)) merged.push(t); });
          return merged;
        });
        setSelectedTags((prev) => Array.from(new Set([...prev, ...formattedTags])));

        // Apply platform difficulty hint (only if not already set from existingSolve)
        if (!isUnrated && !existingSolveData?.difficultyRating) {
          if (data.difficultyLabel === "Easy") setDifficulty(3);
          else if (data.difficultyLabel === "Medium") setDifficulty(6);
          else if (data.difficultyLabel === "Hard") setDifficulty(9);
          else if (data.rating) {
            setDifficulty(Math.min(10, Math.max(1, data.rating / 300)));
          }
        }
      }
    } catch (e) {
      console.error("Auto-fill failed", e);
    } finally {
      setLoadingMeta(false);
    }
  };

  // --- TAG HANDLERS ---
  const toggleTag = (tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  const addCustomTag = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && customTag.trim()) {
      e.preventDefault();
      const val = customTag.trim();
      // Add to both allKnownTags (pool) and selectedTags (selected)
      setAllKnownTags((prev) => (prev.includes(val) ? prev : [...prev, val]));
      setSelectedTags((prev) => (prev.includes(val) ? prev : [...prev, val]));
      setCustomTag("");
    }
  };

  // --- ALTERNATE SOLUTION HANDLERS ---
  const addAltSolution = () => {
    if (altSolutions.length >= MAX_ALT_SOLUTIONS) return;
    setAltSolutions((prev) => [...prev, { label: "", tab: "paste", code: "" }]);
  };

  const removeAltSolution = (index: number) => {
    setAltSolutions((prev) => prev.filter((_, i) => i !== index));
    setAltFilesRef((prev) => {
      const updated = { ...prev };
      delete updated[index];
      return updated;
    });
  };

  const updateAltSolution = (index: number, field: keyof AltSolution, value: string) => {
    setAltSolutions((prev) =>
      prev.map((alt, i) => (i === index ? { ...alt, [field]: value } : alt))
    );
  };

  const updateAltFile = (index: number, file: File | null) => {
    setAltFilesRef((prev) => ({ ...prev, [index]: file }));
  };

  // --- SUBMIT LOGIC ---
  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setInlineError(null);

    if (selectedTags.length === 0) {
      setInlineError("Please select at least one tag.");
      return;
    }

    const fileInput = e.currentTarget.elements.namedItem("file") as HTMLInputElement;
    if (fileInput?.files?.length) {
      const file = fileInput.files[0];
      if (file.size > 1 * 1024 * 1024) {
        setInlineError("File is too large! Max size is 1 MB.");
        return;
      }
    }

    setIsSubmitting(true);

    try {
      const formData = new FormData(e.currentTarget);

      // Tags
      formData.set("tags", JSON.stringify(selectedTags));

      // Solution title
      if (solutionTitle.trim()) {
        formData.set("solutionTitle", solutionTitle.trim());
      }

      // Personal difficulty rating
      if (isUnrated) {
        formData.set("difficulty", "-1");
      }

      // Alternate solutions — encode as alt_label_N, alt_code_N, alt_file_N
      altSolutions.forEach((alt, i) => {
        formData.set(`alt_label_${i}`, alt.label || `Alternate Solution ${i + 1}`);
        if (alt.tab === "paste") {
          formData.set(`alt_code_${i}`, alt.code);
        } else {
          const file = altFilesRef[i];
          if (file) {
            formData.set(`alt_file_${i}`, file);
          }
        }
      });

      const res = await fetch("/api/submit", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to submit");
      }

      router.push("/");
      router.refresh();
    } catch (error: unknown) {
      console.error(error);
      setInlineError((error as Error).message || "Something went wrong. Check console.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Auto-dismiss inline error after 6 seconds
  useEffect(() => {
    if (!inlineError) return;
    const t = setTimeout(() => setInlineError(null), 6000);
    return () => clearTimeout(t);
  }, [inlineError]);

  const isResubmission = !!existingSolve;

  return (
    <div className="max-w-4xl mx-auto p-6 text-gray-100">

      {/* Header */}
      <div className="mb-8 border-b border-gray-800 pb-6">
        <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-emerald-400 bg-clip-text text-transparent">
          {isResubmission ? "Add a New Solution" : "New Submission"}
        </h1>
        <p className="text-gray-400 mt-2 flex items-center gap-2">
          <span className="bg-gray-800 text-xs px-2 py-1 rounded-full border border-gray-700">
            {user?.firstName || "User"}
          </span>
          {isResubmission ? "adding another approach." : "creating a record."}
        </p>
      </div>

      <form className="space-y-8" onSubmit={handleSubmit}>

        {/* Inline error banner (replaces browser alert()) */}
        {inlineError && (
          <div className="flex items-center justify-between gap-3 px-4 py-3 rounded-lg bg-red-900/20 border border-red-800/50 text-red-400 text-sm animate-in slide-in-from-top-2">
            <div className="flex items-center gap-2">
              <AlertCircle size={16} className="shrink-0" />
              {inlineError}
            </div>
            <button
              type="button"
              onClick={() => setInlineError(null)}
              className="text-red-500 hover:text-red-300 transition"
            >
              <X size={14} />
            </button>
          </div>
        )}

        <div className="bg-gray-900/50 p-6 rounded-xl border border-gray-800">
          <label className="block text-sm font-bold text-gray-300 mb-2 flex justify-between">
            <span>Problem Link <span className="text-red-500">*</span></span>
            {loadingMeta && (
              <span className="text-xs text-blue-400 flex items-center gap-1 animate-pulse">
                <Loader2 size={12} className="animate-spin" /> Fetching info...
              </span>
            )}
          </label>
          <div className="relative">
            <input
              name="url"
              type="url"
              value={url}
              onChange={(e) => {
                const newUrl = e.target.value;
                setUrl(newUrl);
                setExistingSolve(null);

                // R3: Auto-enrich after 1 second of inactivity
                if (enrichDebounceRef.current) clearTimeout(enrichDebounceRef.current);
                if (newUrl.trim()) {
                  enrichDebounceRef.current = setTimeout(() => handleAutoFill(), 1000);
                }
              }}
              onBlur={handleAutoFill}
              placeholder="https://leetcode.com/problems/..."
              className="w-full p-4 bg-gray-950 border border-gray-800 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-transparent outline-none transition text-blue-400 placeholder-gray-600 pr-10"
              required
            />
            <div className="absolute right-3 top-4 text-gray-600">
              {loadingMeta ? <Loader2 className="animate-spin text-blue-500" size={20} /> : <Sparkles size={18} />}
            </div>
          </div>

          {/* Re-submission info strip — soft, non-alarming */}
          {isResubmission && existingSolve && (
            <div className="mt-3 flex items-center gap-3 px-4 py-3 rounded-lg bg-emerald-950/40 border border-emerald-800/50">
              <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
              <span className="text-sm text-emerald-300">
                You solved this{" "}
                <span className="font-semibold">{daysAgoLabel(existingSolve.firstSolvedAt)}</span>
                {" · "}Adding a new solution
              </span>
            </div>
          )}
        </div>

        {/* 2. Personal Difficulty Rating */}
        <div className="bg-gray-900/50 p-6 rounded-xl border border-gray-800">
          <div className="flex items-center justify-between mb-4">
            <div>
              <label className="text-sm font-bold text-gray-300">My Difficulty Rating</label>
              <p className="text-xs text-gray-500 mt-0.5">Your personal rating — the community average is computed from all ratings.</p>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="unrated"
                checked={isUnrated}
                onChange={(e) => setIsUnrated(e.target.checked)}
                className="w-4 h-4 rounded border-gray-600 bg-gray-800 accent-blue-600"
              />
              <label htmlFor="unrated" className="text-xs text-gray-400 cursor-pointer select-none">
                Can&apos;t Rate / Unrated
              </label>
            </div>
          </div>

          <div className={`transition-opacity ${isUnrated ? "opacity-30 pointer-events-none" : "opacity-100"}`}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-emerald-500 font-mono">Easy (0)</span>
              <span
                className={`text-3xl font-bold font-mono transition-colors ${
                  difficulty >= 8 ? "text-red-500" : difficulty >= 4 ? "text-blue-500" : "text-emerald-500"
                }`}
              >
                {isUnrated ? "N/A" : difficulty.toFixed(1)}
              </span>
              <span className="text-xs text-red-500 font-mono">Hard (10)</span>
            </div>
            <input
              name="difficulty"
              type="range"
              min="0"
              max="10"
              step="0.5"
              value={difficulty}
              onChange={(e) => setDifficulty(parseFloat(e.target.value))}
              className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-500 hover:accent-blue-400"
            />
          </div>
        </div>

        {/* 3. Tags */}
        <div className="bg-gray-900/50 p-6 rounded-xl border border-gray-800">
          <label className="block text-sm font-bold text-gray-300 mb-4">
            Tags <span className="text-red-500">*</span>
          </label>

          {/* Selected tags shown as chips */}
          <div className="flex flex-wrap gap-2 mb-4">
            {selectedTags.map((tag) => (
              <span
                key={tag}
                className="bg-blue-900/30 text-blue-300 border border-blue-800 px-3 py-1 rounded-full text-sm flex items-center gap-2 animate-in fade-in zoom-in duration-200"
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

          {/* Tag pool — shows ALL known tags; selected ones show with ✓ (not hidden) */}
          <div className="flex flex-wrap gap-2">
            {allKnownTags.map((tag) => {
              const isSelected = selectedTags.includes(tag);
              return (
                <button
                  key={tag}
                  type="button"
                  onClick={() => toggleTag(tag)}
                  className={`text-xs px-3 py-1 rounded-full border transition-all flex items-center gap-1 ${
                    isSelected
                      ? "bg-blue-600/20 border-blue-500 text-blue-300"
                      : "bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-500"
                  }`}
                >
                  {isSelected && <Check size={10} />}
                  {tag}
                </button>
              );
            })}
          </div>
        </div>

        {/* 4. Solution Title (shown for re-submissions or as optional label) */}
        <div className="bg-gray-900/50 p-6 rounded-xl border border-gray-800">
          <label className="block text-sm font-bold text-gray-300 mb-2">
            Solution Title{" "}
            <span className="text-gray-500 font-normal text-xs">
              {isResubmission ? "(label for this new approach)" : "(optional label)"}
            </span>
          </label>
          <input
            type="text"
            value={solutionTitle}
            onChange={(e) => setSolutionTitle(e.target.value)}
            placeholder={isResubmission ? "e.g. Optimized O(log n), BFS Variant..." : "e.g. Sliding Window Approach (optional)"}
            className="w-full p-4 bg-gray-950 border border-gray-800 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-transparent outline-none transition text-gray-200 placeholder-gray-600"
          />
        </div>

        {/* 5. Main Solution Code */}
        <div className="bg-gray-900/50 p-6 rounded-xl border border-gray-800">
          <div className="flex items-center justify-between mb-4">
            <label className="text-sm font-bold text-gray-300">
              {isResubmission ? "New Solution Code" : "Solution Code"}{" "}
              <span className="text-red-500">*</span>
            </label>
            <div className="flex bg-gray-800 rounded-lg p-1">
              <button
                type="button"
                onClick={() => setActiveTab("paste")}
                className={`px-3 py-1 rounded-md text-xs font-medium transition ${activeTab === "paste" ? "bg-gray-700 text-white shadow" : "text-gray-400"}`}
              >
                Paste
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("file")}
                className={`px-3 py-1 rounded-md text-xs font-medium transition ${activeTab === "file" ? "bg-gray-700 text-white shadow" : "text-gray-400"}`}
              >
                Upload
              </button>
            </div>
          </div>

          {activeTab === "paste" ? (
            <textarea
              name="code"
              rows={12}
              className="w-full p-4 font-mono text-sm bg-black text-emerald-400 border border-gray-800 rounded-lg focus:ring-1 focus:ring-emerald-500 outline-none"
              placeholder={isResubmission ? "// Paste your new solution here..." : "// Paste your main solution here..."}
              required={activeTab === "paste"}
            />
          ) : (
            <div className="border-2 border-dashed border-gray-700 rounded-lg p-12 text-center hover:bg-gray-800/50 transition cursor-pointer group">
              <Upload className="mx-auto h-8 w-8 text-gray-500 group-hover:text-blue-400 mb-3 transition-colors" />
              <input
                type="file"
                name="file"
                className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:bg-gray-700 file:text-gray-300 hover:file:bg-gray-600"
              />
            </div>
          )}
        </div>

        {/* 6. Alternate Solutions */}
        <div className="border border-gray-800 rounded-xl overflow-hidden">
          <div className="flex items-center justify-between p-4 bg-gray-900">
            <span className="font-semibold text-gray-300 flex items-center gap-2">
              <Plus size={16} />
              Alternate Solutions
            </span>
            <div className="flex items-center gap-3">
              {altSolutions.length > 0 && (
                <span className="text-xs text-gray-500 font-mono">
                  {altSolutions.length} / {MAX_ALT_SOLUTIONS}
                </span>
              )}
              <button
                type="button"
                onClick={addAltSolution}
                disabled={altSolutions.length >= MAX_ALT_SOLUTIONS}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600/10 text-blue-400 border border-blue-900/50 hover:bg-blue-600/20 transition text-xs font-medium disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <Plus size={12} />
                Add
              </button>
            </div>
          </div>

          {altSolutions.length === 0 && (
            <div className="p-6 text-center text-sm text-gray-600 bg-gray-900/20">
              No alternate solutions added. Click <span className="text-blue-500">Add</span> to include up to {MAX_ALT_SOLUTIONS}.
            </div>
          )}

          {altSolutions.map((alt, index) => (
            <AltSolutionBlock
              key={index}
              index={index}
              alt={alt}
              onChange={updateAltSolution}
              onFileChange={updateAltFile}
              onRemove={removeAltSolution}
            />
          ))}
        </div>

        {/* 7. Notes / Learnings */}
        <div className="bg-gray-900/50 p-6 rounded-xl border border-gray-800">
          <label className="block text-sm font-bold text-gray-300 mb-2">
            Notes / Learnings
          </label>
          <textarea
            name="notes"
            rows={3}
            defaultValue={isResubmission && existingSolve?.notes ? existingSolve.notes : ""}
            className="w-full p-4 font-sans text-sm bg-gray-950 border border-gray-800 rounded-lg focus:ring-2 focus:ring-blue-600 outline-none text-gray-300 placeholder-gray-600"
            placeholder="Key takeaway: Used a HashMap to optimize lookup to O(1)..."
          />
        </div>

        {/* Submit Action */}
        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full bg-gradient-to-r from-blue-600 to-blue-700 text-white py-4 rounded-xl font-bold hover:from-blue-500 hover:to-blue-600 transition-all shadow-lg shadow-blue-900/20 active:scale-[0.99] flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSubmitting ? (
            <span className="flex items-center gap-2">
              <Loader2 className="animate-spin" /> Submitting...
            </span>
          ) : (
            <>
              <span>{isResubmission ? "Add Solution" : "Confirm Submission"}</span>
              <AlertCircle size={16} className="opacity-50" />
            </>
          )}
        </button>

      </form>
    </div>
  );
}

// --- Sub-component: Individual Alternate Solution Block ---
interface AltSolutionBlockProps {
  index: number;
  alt: AltSolution;
  onChange: (index: number, field: keyof AltSolution, value: string) => void;
  onFileChange: (index: number, file: File | null) => void;
  onRemove: (index: number) => void;
}

function AltSolutionBlock({ index, alt, onChange, onFileChange, onRemove }: AltSolutionBlockProps) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="border-t border-gray-800 bg-gray-900/20 animate-in slide-in-from-top-2">
      {/* Block Header */}
      <div className="flex items-center justify-between px-4 py-3 hover:bg-gray-800/30 transition">
        <button
          type="button"
          onClick={() => setCollapsed(!collapsed)}
          className="flex items-center gap-2 text-sm text-gray-400 flex-1 text-left"
        >
          {collapsed ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
          <span className="text-gray-500 font-mono text-xs">ALT {index + 1}</span>
          <span className="text-gray-300 truncate max-w-xs">
            {alt.label || `Alternate Solution ${index + 1}`}
          </span>
        </button>
        <button
          type="button"
          onClick={() => onRemove(index)}
          className="p-1.5 rounded-md text-gray-600 hover:text-red-400 hover:bg-red-900/10 transition"
        >
          <X size={14} />
        </button>
      </div>

      {/* Block Body */}
      {!collapsed && (
        <div className="px-4 pb-4 space-y-3">
          <input
            type="text"
            value={alt.label}
            onChange={(e) => onChange(index, "label", e.target.value)}
            placeholder="Label (e.g., 'Optimized O(log n)' or 'Recursive Approach')"
            className="w-full p-3 bg-gray-950 border border-gray-800 rounded-lg focus:border-blue-500 outline-none text-sm text-white placeholder-gray-600"
          />

          <div className="flex gap-2 text-xs mb-1">
            <button
              type="button"
              onClick={() => onChange(index, "tab", "paste")}
              className={`${alt.tab === "paste" ? "text-blue-400 underline" : "text-gray-500"} transition`}
            >
              Paste Code
            </button>
            <span className="text-gray-700">|</span>
            <button
              type="button"
              onClick={() => onChange(index, "tab", "file")}
              className={`${alt.tab === "file" ? "text-blue-400 underline" : "text-gray-500"} transition`}
            >
              Upload File
            </button>
          </div>

          {alt.tab === "paste" ? (
            <textarea
              value={alt.code}
              onChange={(e) => onChange(index, "code", e.target.value)}
              rows={6}
              className="w-full p-3 font-mono text-sm bg-black text-gray-300 border border-gray-800 rounded-lg outline-none focus:ring-1 focus:ring-blue-500 resize-y"
              placeholder="// Paste alternate solution code..."
            />
          ) : (
            <input
              type="file"
              onChange={(e) => onFileChange(index, e.target.files?.[0] ?? null)}
              className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:bg-gray-800 file:text-gray-300 hover:file:bg-gray-700"
            />
          )}
        </div>
      )}
    </div>
  );
}