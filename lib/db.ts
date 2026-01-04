import { getFile, saveFile } from "./github";
import { IndexEntry, IndexEntrySchema, UserSchema } from "./types";

const INDEX_PATH = "data/index.json"; 
const MAX_RETRIES = 5;

const wait = (ms: number) => new Promise((res) => setTimeout(res, ms));

/**
 * 1. SAFE INDEX UPDATE
 * Now supports entries with 'userId'
 */
export async function safeUpdateIndex(newEntry: IndexEntry) {
  let attempts = 0;

  while (attempts < MAX_RETRIES) {
    try {
      const { content, sha, exists } = await getFile(INDEX_PATH);
      
      let index: IndexEntry[] = [];
      if (exists && Array.isArray(content)) {
        index = content;
      }

      // Append new entry to the START
      const newIndex = [newEntry, ...index];

      await saveFile(INDEX_PATH, newIndex, sha, `Add submission: ${newEntry.title}`);
      return; 

    } catch (error: any) {
      // Robust check for 409 Conflict
      if (error.message === "CONFLICT" || error.message.includes("409")) {
        attempts++;
        await wait(200 + Math.random() * 200);
      } else {
        throw error;
      }
    }
  }
  throw new Error("Failed to update index after max retries.");
}

/**
 * 2. SAFE USER STATS UPDATE (ID-BASED)
 * Uses userId as the filename for privacy.
 */
export async function safeUpdateUserStats(userId: string, username: string, dateStr: string) {
  let attempts = 0;
  // CRITICAL CHANGE: File is now named by ID, not Name
  const userPath = `data/users/${userId}.json`;

  while (attempts < MAX_RETRIES) {
    try {
      const { content, sha, exists } = await getFile(userPath);
      
      // Default Profile
      let profile = {
        userId: userId,
        username: username,
        joinDate: new Date().toISOString(),
        stats: { totalSolved: 0, currentStreak: 0, datesSolved: [] as string[], debt: 0 }
      };

      if (exists && content) {
        profile = {
          ...profile,
          ...content,
          // Update username in case they changed it in Clerk, but keep stats
          username: username, 
          stats: { ...profile.stats, ...(content.stats || {}) }
        };
      }

      // Update Logic
      if (!profile.stats.datesSolved.includes(dateStr)) {
        profile.stats.datesSolved.push(dateStr);
        profile.stats.currentStreak += 1;
      }
      profile.stats.totalSolved += 1;

      await saveFile(userPath, profile, sha, `Update stats for ${username}`);
      return; 

    } catch (error: any) {
      if (error.message === "CONFLICT" || error.message.includes("409")) {
        attempts++;
        await wait(200 + Math.random() * 200);
      } else {
        throw error;
      }
    }
  }
  throw new Error("Failed to update user profile after max retries.");
}

/**
 * 3. GET USER PROFILE (RESTORED & UPDATED)
 * Fetches user data by userId safely
 */
export async function getUserProfile(userId: string) {
  const path = `data/users/${userId}.json`;
  const { content, exists } = await getFile(path);
  
  if (!exists) return null;
  
  // Optional: You can validate it matches the schema if you want strictness
  return UserSchema.parse(content); 
}

export async function getGlobalTags(): Promise<string[]> {
  const { content, exists } = await getFile("data/tags.json");
  if (!exists || !Array.isArray(content)) return [];
  return content;
}

export async function safeUpdateGlobalTags(newTags: string[]) {
  const TAGS_PATH = "data/tags.json";
  let attempts = 0;

  while (attempts < MAX_RETRIES) {
    try {
      const { content, sha, exists } = await getFile(TAGS_PATH);
      
      let currentTags: string[] = [];
      if (exists && Array.isArray(content)) {
        currentTags = content;
      }

      // Merge and Deduplicate
      const combined = Array.from(new Set([...currentTags, ...newTags])).sort();

      // Optimization: If no new tags were added, don't waste a write
      if (combined.length === currentTags.length) return;

      await saveFile(TAGS_PATH, combined, sha, "Update global tags");
      return;

    } catch (error: any) {
      if (error.message === "CONFLICT" || error.message.includes("409")) {
        attempts++;
        await wait(200 + Math.random() * 200);
      } else {
        console.error("Failed to update tags:", error);
        return; // Non-fatal error, don't crash the submission
      }
    }
  }
}