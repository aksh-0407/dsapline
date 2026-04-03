"use client";

import { useState } from "react";
import { useUser } from "@clerk/nextjs";
import { Plus, X, Upload, AlertCircle, Loader2, Sparkles, ChevronDown, ChevronUp } from "lucide-react";
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

export function SubmitForm() {
  const { user } = useUser();
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loadingMeta, setLoadingMeta] = useState(false);

  // --- FORM STATE ---
  const [url, setUrl] = useState("");
  const [activeTab, setActiveTab] = useState<"paste" | "file">("paste");

  const [difficulty, setDifficulty] = useState(5.0);
  const [isUnrated, setIsUnrated] = useState(false);

  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [customTag, setCustomTag] = useState("");

  // Alternate solutions — dynamic list, max MAX_ALT_SOLUTIONS
  const [altSolutions, setAltSolutions] = useState<AltSolution[]>([]);
  const [altFilesRef, setAltFilesRef] = useState<Record<number, File | null>>({});

  const handleAutoFill = async () => {
    if (!url) return;
    setLoadingMeta(true);

    try {
      const res = await fetch("/api/parse-url", {
        method: "POST",
        body: JSON.stringify({ url }),
      });
      const { success, data } = await res.json();

      if (success && data) {
        if (data.tags && Array.isArray(data.tags)) {
          const formattedTags = data.tags.map((t: string) =>
            t.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
          );
          setSelectedTags((prev) => Array.from(new Set([...prev, ...formattedTags])));
        }

        if (!isUnrated) {
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
      if (!selectedTags.includes(val)) {
        setSelectedTags((prev) => [...prev, val]);
      }
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

    if (selectedTags.length === 0) {
      alert("Please select at least one tag.");
      return;
    }

    const fileInput = e.currentTarget.elements.namedItem("file") as HTMLInputElement;
    if (fileInput?.files?.length) {
      const file = fileInput.files[0];
      if (file.size > 1 * 1024 * 1024) {
        alert("File is too large! Max size is 1MB.");
        return;
      }
    }

    setIsSubmitting(true);

    try {
      const formData = new FormData(e.currentTarget);

      // Tags
      formData.set("tags", JSON.stringify(selectedTags));

      // Personal difficulty rating
      if (isUnrated) {
        formData.delete("difficulty");
        // Send -1 to signal unrated; API will convert to null
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
      alert((error as Error).message || "Something went wrong. Check console.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6 text-gray-100">

      {/* Header */}
      <div className="mb-8 border-b border-gray-800 pb-6">
        <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-emerald-400 bg-clip-text text-transparent">
          New Submission
        </h1>
        <p className="text-gray-400 mt-2 flex items-center gap-2">
          <span className="bg-gray-800 text-xs px-2 py-1 rounded-full border border-gray-700">
            {user?.firstName || "User"}
          </span>
          creating a record.
        </p>
      </div>

      <form className="space-y-8" onSubmit={handleSubmit}>

        {/* 1. Problem Link */}
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
              onChange={(e) => setUrl(e.target.value)}
              onBlur={handleAutoFill}
              placeholder="https://leetcode.com/problems/..."
              className="w-full p-4 bg-gray-950 border border-gray-800 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-transparent outline-none transition text-blue-400 placeholder-gray-600 pr-10"
              required
            />
            <div className="absolute right-3 top-4 text-gray-600">
              {loadingMeta ? <Loader2 className="animate-spin text-blue-500" size={20} /> : <Sparkles size={18} />}
            </div>
          </div>
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

          <div className="flex flex-wrap gap-2">
            {PREDEFINED_TAGS.map((tag) => (
              <button
                key={tag}
                type="button"
                onClick={() => toggleTag(tag)}
                className={`text-xs px-3 py-1 rounded-full border transition-all ${
                  selectedTags.includes(tag)
                    ? "bg-blue-600 border-blue-500 text-white hidden"
                    : "bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-500"
                }`}
              >
                {tag}
              </button>
            ))}
          </div>
        </div>

        {/* 4. Main Solution Code */}
        <div className="bg-gray-900/50 p-6 rounded-xl border border-gray-800">
          <div className="flex items-center justify-between mb-4">
            <label className="text-sm font-bold text-gray-300">Solution Code <span className="text-red-500">*</span></label>
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
              placeholder="// Paste your main solution here..."
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

        {/* 5. Alternate Solutions */}
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

        {/* 6. Notes / Learnings */}
        <div className="bg-gray-900/50 p-6 rounded-xl border border-gray-800">
          <label className="block text-sm font-bold text-gray-300 mb-2">
            Notes / Learnings
          </label>
          <textarea
            name="notes"
            rows={3}
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
              <span>Confirm Submission</span>
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