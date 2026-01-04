import { z } from "zod";

// --- 1. USER PROFILE ---
export const UserSchema = z.object({
  userId: z.string(),
  username: z.string(),
  joinDate: z.string().datetime(),
  stats: z.object({
    totalSolved: z.number().int().nonnegative(),
    currentStreak: z.number().int().nonnegative(),
    datesSolved: z.array(z.string()),
    debt: z.number().nonnegative().optional(),
  }),
});

export type UserProfile = z.infer<typeof UserSchema>;

// --- 2. SUBMISSION METADATA ---
export const SubmissionSchema = z.object({
  id: z.string().uuid(),
  userId: z.string(),
  username: z.string(),
  
  // Question Details
  question: z.object({
    title: z.string().min(1),
    url: z.string().url(),
  }),

  // User's Input
  difficulty: z.number(), 
  tags: z.array(z.string()),
  notes: z.string().optional(),
  
  // System Details
  timestamp: z.string().datetime(),
  
  // Main Solution
  mainSolution: z.object({
    path: z.string(),
    extension: z.string(),
    code: z.string().optional() // <--- ADDED: Allow code injection for UI
  }),

  // Alternate Solution
  alternateSolution: z.object({
    path: z.string(),
    extension: z.string(),
    label: z.string().optional(), // <--- ADDED: Fixes the 'label' error
    code: z.string().optional()   // <--- ADDED: Allow code injection for UI
  }).nullable(),
  
  platform: z.enum(["leetcode", "codeforces", "hackerrank", "geeksforgeeks", "other"]),
  
  // Phase 7 Enrichment
  enrichment: z.object({
    realTitle: z.string().optional(),
    difficultyLabel: z.string().optional(),
    rating: z.number().optional(),
    contestId: z.string().optional(),
    problemIndex: z.string().optional(),
  }).optional()
});

export type Submission = z.infer<typeof SubmissionSchema>;

// --- 3. THE GLOBAL INDEX ---
export const IndexEntrySchema = z.object({
  id: z.string(),
  title: z.string(),
  difficulty: z.number(),
  tags: z.array(z.string()),
  username: z.string(),
  userId: z.string(),
  date: z.string(),
  timestamp: z.string(),
  platform: z.enum(["leetcode", "codeforces", "hackerrank", "geeksforgeeks", "other"]),
  
  // Metadata fields
  difficultyLabel: z.string().optional(),
  rating: z.number().optional(),
  contestId: z.string().optional(),
  problemIndex: z.string().optional(),
});

export type IndexEntry = z.infer<typeof IndexEntrySchema>;