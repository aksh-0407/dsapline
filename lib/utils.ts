import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

// Tailwind helper (Standard in Next.js projects)
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * TAG NORMALIZATION LOGIC
 * 1. Removes special chars (hyphens, underscores).
 * 2. Converts to Title Case for display.
 * 3. Prevents duplicates like "Array" vs "array".
 */

// Helper to generate a "fingerprint" for comparison
// e.g., "Depth-First Search" -> "depthfirstsearch"
function getTagFingerprint(tag: string): string {
  return tag.toLowerCase().replace(/[^a-z0-9]/g, "");
}

// Helper to convert "binary-search" -> "Binary Search"
function toTitleCase(str: string): string {
  return str
    .replace(/[-_]/g, " ") // Replace separators with space
    .split(" ")
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

export function normalizeTags(existingTags: string[], newTags: string[]): string[] {
  // 1. Create a map of existing fingerprints
  // Map<fingerprint, originalDisplayTag>
  // e.g., "binarysearch" -> "Binary Search"
  const existingMap = new Map<string, string>();
  
  existingTags.forEach(tag => {
    existingMap.set(getTagFingerprint(tag), tag);
  });

  const finalTags = new Set<string>(existingTags);

  // 2. Process new tags
  newTags.forEach(rawTag => {
    const fingerprint = getTagFingerprint(rawTag);
    
    if (existingMap.has(fingerprint)) {
      // MATCH FOUND! 
      // If user typed "binary-search", we ignore it and keep the existing "Binary Search".
      // We don't need to do anything because 'existingTags' are already in 'finalTags'.
    } else {
      // NEW TAG!
      // Format it nicely (Title Case) and add it.
      const formattedTag = toTitleCase(rawTag);
      finalTags.add(formattedTag);
      
      // Update map so we don't add it twice in the same batch
      existingMap.set(fingerprint, formattedTag);
    }
  });

  return Array.from(finalTags).sort();
}