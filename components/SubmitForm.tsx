"use client";

import { useState, useEffect } from "react";
import { useUser } from "@clerk/nextjs";
import { Plus, X, Upload, AlertCircle, Loader2, Sparkles } from "lucide-react"; // Added Loader/Sparkles
import { useRouter } from "next/navigation"; 

const PREDEFINED_TAGS = [
  "Array", "String", "Hash Table", "DP", "Math", 
  "Two Pointers", "Binary Search", "Greedy", "Stack", 
  "Graph", "Recursion", "Linked List", "Tree"
];

export function SubmitForm() {
  const { user } = useUser();
  const router = useRouter(); 
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loadingMeta, setLoadingMeta] = useState(false); // NEW: Auto-fill loading state
  
  // --- FORM STATE ---
  const [url, setUrl] = useState(""); // NEW: Controlled input for URL
  const [activeTab, setActiveTab] = useState<"paste" | "file">("paste");
  const [altTab, setAltTab] = useState<"paste" | "file">("paste");
  
  const [difficulty, setDifficulty] = useState(5.0);
  const [isUnrated, setIsUnrated] = useState(false);
  
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [customTag, setCustomTag] = useState("");
  
  const [showAlternate, setShowAlternate] = useState(false);
  
  // --- NEW: FETCH AVAILABLE TAGS ON MOUNT (Optional but recommended) ---
  // If you want the "Quick Select" to eventually show new tags, you can fetch them here.
  // For now, we keep your static PREDEFINED_TAGS list as requested, 
  // but the 'selectedTags' will grow dynamically.

  // --- NEW: SMART AUTO-FILL LOGIC ---
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
        // 1. Auto-Add Tags (Merge with existing)
        if (data.tags && Array.isArray(data.tags)) {
          // Normalize incoming tags to title case for cleaner UI
          const formattedTags = data.tags.map((t: string) => 
            t.replace(/-/g, " ").replace(/\b\w/g, c => c.toUpperCase())
          );
          
          setSelectedTags(prev => {
            const newSet = new Set([...prev, ...formattedTags]);
            return Array.from(newSet);
          });
        }

        // 2. Auto-Set Difficulty (Only if not set to Unrated)
        if (!isUnrated) {
          if (data.difficultyLabel === "Easy") setDifficulty(3);
          else if (data.difficultyLabel === "Medium") setDifficulty(6);
          else if (data.difficultyLabel === "Hard") setDifficulty(9);
          else if (data.rating) {
            // Map Codeforces Rating (800-3500) to 1-10 scale
            // 800 -> 2, 1200 -> 3, 2000 -> 7, 3000 -> 10
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

  // --- UI HANDLERS ---
  const toggleTag = (tag: string) => {
    if (selectedTags.includes(tag)) {
      setSelectedTags(selectedTags.filter(t => t !== tag));
    } else {
      setSelectedTags([...selectedTags, tag]);
    }
  };

  const addCustomTag = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && customTag.trim()) {
      e.preventDefault();
      const val = customTag.trim();
      if (!selectedTags.includes(val)) {
        setSelectedTags([...selectedTags, val]);
      }
      setCustomTag("");
    }
  };

  // --- SUBMIT LOGIC (The Wiring) ---
  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    
    // Basic Client-Side Validation
    if (selectedTags.length === 0) {
      alert("Please select at least one tag.");
      return;
    }

    const fileInput = (e.currentTarget.elements.namedItem('file') as HTMLInputElement);
    if (fileInput?.files?.length) {
      const file = fileInput.files[0];
      if (file.size > 2 * 1024 * 1024) { // 2MB Limit
        alert("File is too large! Max size is 2MB.");
        return;
      }
    }

    setIsSubmitting(true);

    try {
      const formData = new FormData(e.currentTarget);
      
      // 1. Manually add Tags
      formData.set("tags", JSON.stringify(selectedTags));
      
      // 2. Handle Difficulty for Unrated
      if (isUnrated) {
        formData.set("difficulty", "-1");
      }

      // 3. Send to API
      const res = await fetch("/api/submit", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to submit");
      }

      // Success!
      router.push("/"); // Changed to dashboard based on typical flow
      router.refresh(); 

    } catch (error: any) {
      console.error(error);
      alert(error.message || "Something went wrong. Check console.");
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
        
        {/* 1. Problem Link (Required + AUTO FILL) */}
        <div className="bg-gray-900/50 p-6 rounded-xl border border-gray-800">
          <label className="block text-sm font-bold text-gray-300 mb-2 flex justify-between">
            <span>Problem Link <span className="text-red-500">*</span></span>
            {/* Loading Indicator */}
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
              onBlur={handleAutoFill} // TRIGGER ON BLUR
              placeholder="https://leetcode.com/problems/..."
              className="w-full p-4 bg-gray-950 border border-gray-800 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-transparent outline-none transition text-blue-400 placeholder-gray-600 pr-10"
              required
            />
            {/* Sparkle Icon inside Input */}
            <div className="absolute right-3 top-4 text-gray-600">
              {loadingMeta ? <Loader2 className="animate-spin text-blue-500" size={20} /> : <Sparkles size={18} />}
            </div>
          </div>
        </div>

        {/* 2. Difficulty (Required) */}
        <div className="bg-gray-900/50 p-6 rounded-xl border border-gray-800">
          <div className="flex items-center justify-between mb-4">
            <label className="text-sm font-bold text-gray-300">Difficulty Rating</label>
            <div className="flex items-center gap-2">
              <input 
                type="checkbox" 
                id="unrated"
                checked={isUnrated}
                onChange={(e) => setIsUnrated(e.target.checked)}
                className="w-4 h-4 rounded border-gray-600 bg-gray-800 accent-blue-600"
              />
              <label htmlFor="unrated" className="text-xs text-gray-400 cursor-pointer select-none">
                Can't Rate / Unrated
              </label>
            </div>
          </div>

          <div className={`transition-opacity ${isUnrated ? 'opacity-30 pointer-events-none' : 'opacity-100'}`}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-emerald-500 font-mono">Easy (0)</span>
              <span className={`text-3xl font-bold font-mono transition-colors ${
                  difficulty >= 8 ? "text-red-500" : difficulty >= 4 ? "text-blue-500" : "text-emerald-500"
                }`}>
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

        {/* 3. Tags (Required) */}
        <div className="bg-gray-900/50 p-6 rounded-xl border border-gray-800">
          <label className="block text-sm font-bold text-gray-300 mb-4">
            Tags <span className="text-red-500">*</span>
          </label>
          
          {/* Selected Tags Display */}
          <div className="flex flex-wrap gap-2 mb-4">
            {selectedTags.map(tag => (
              <span key={tag} className="bg-blue-900/30 text-blue-300 border border-blue-800 px-3 py-1 rounded-full text-sm flex items-center gap-2 animate-in fade-in zoom-in duration-200">
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

          {/* Quick Select (Predefined) */}
          <div className="flex flex-wrap gap-2">
            {PREDEFINED_TAGS.map(tag => (
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
            <label className="text-sm font-bold text-gray-300">Solution Code</label>
            <div className="flex bg-gray-800 rounded-lg p-1">
              <button
                type="button"
                onClick={() => setActiveTab("paste")}
                className={`px-3 py-1 rounded-md text-xs font-medium transition ${activeTab === 'paste' ? 'bg-gray-700 text-white shadow' : 'text-gray-400'}`}
              >
                Paste
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("file")}
                className={`px-3 py-1 rounded-md text-xs font-medium transition ${activeTab === 'file' ? 'bg-gray-700 text-white shadow' : 'text-gray-400'}`}
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
              required={activeTab === 'paste'} 
            />
          ) : (
             <div className="border-2 border-dashed border-gray-700 rounded-lg p-12 text-center hover:bg-gray-800/50 transition cursor-pointer group">
              <Upload className="mx-auto h-8 w-8 text-gray-500 group-hover:text-blue-400 mb-3 transition-colors" />
              <input type="file" name="file" className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:bg-gray-700 file:text-gray-300 hover:file:bg-gray-600" />
            </div>
          )}
        </div>

        {/* 5. Alternate Solution (Optional) */}
        <div className="border border-gray-800 rounded-xl overflow-hidden">
          <button 
            type="button"
            onClick={() => setShowAlternate(!showAlternate)}
            className="w-full flex items-center justify-between p-4 bg-gray-900 hover:bg-gray-800 transition text-left"
          >
            <span className="font-semibold text-gray-300 flex items-center gap-2">
              <Plus size={16} className={showAlternate ? "rotate-45 transition-transform" : "transition-transform"} />
              Add Alternate Solution
            </span>
            <span className="text-xs text-gray-500">Optional</span>
          </button>
          
          {showAlternate && (
            <div className="p-6 bg-gray-900/30 border-t border-gray-800 space-y-4 animate-in slide-in-from-top-2">
              <input 
                name="altLabel"
                type="text"
                placeholder="Label (e.g., 'Optimized Approach' or 'Recursive Solution')"
                className="w-full p-3 bg-gray-950 border border-gray-800 rounded-lg focus:border-blue-500 outline-none text-sm text-white"
              />
              
              <div className="flex gap-2 text-xs mb-2">
                 <button type="button" onClick={() => setAltTab("paste")} className={`${altTab === 'paste' ? 'text-blue-400 underline' : 'text-gray-500'}`}>Paste Code</button>
                 <span className="text-gray-700">|</span>
                 <button type="button" onClick={() => setAltTab("file")} className={`${altTab === 'file' ? 'text-blue-400 underline' : 'text-gray-500'}`}>Upload File</button>
              </div>

              {altTab === "paste" ? (
                <textarea 
                  name="altCode"
                  rows={6}
                  className="w-full p-3 font-mono text-sm bg-black text-gray-300 border border-gray-800 rounded-lg outline-none"
                  placeholder="// Paste alternate solution code..."
                />
              ) : (
                <input type="file" name="altFile" className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:bg-gray-800 file:text-gray-300" />
              )}
            </div>
          )}
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
             <span className="flex items-center gap-2"><Loader2 className="animate-spin" /> Submitting Problem ...</span>
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