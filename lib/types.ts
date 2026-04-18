/**
 * lib/types.ts
 *
 * Active TypeScript types for DSApline V2.
 * The legacy JSON-era Zod schemas (UserSchema, SubmissionSchema) have been
 * removed — all data now flows through Prisma's generated types.
 *
 * IndexEntry is the lightweight read-model used by the Dashboard and
 * recentActivity feed. It is constructed from raw Submission rows.
 *
 * ArchiveEntry is the read-model used by the Archive and filterEngine.
 * It is constructed from SolvedProblem rows (one per unique problem per user).
 */

import { z } from "zod";

// ---------------------------------------------------------------------------
// 1. INDEX ENTRY (Read model — used by Dashboard recentActivity feed)
//    Maps to a single Submission row.
// ---------------------------------------------------------------------------
export const IndexEntrySchema = z.object({
  id: z.string(),
  title: z.string(),

  // Community average difficulty (0-10). May be null if no one has rated yet.
  difficulty: z.number(),

  // The submission author's own rating for this submission. Null = unrated.
  difficultyRating: z.number().nullable().optional(),

  tags: z.array(z.string()),
  username: z.string(),
  userId: z.string(),
  date: z.string(),        // YYYY-MM-DD in IST
  timestamp: z.string(),   // ISO 8601 UTC

  platform: z.enum(["leetcode", "codeforces", "hackerrank", "geeksforgeeks", "other"]),

  // Enrichment metadata (optional — not all submissions have these)
  difficultyLabel: z.string().optional(),   // "Easy" | "Medium" | "Hard"
  rating: z.number().optional(),            // Codeforces rating
  contestId: z.string().optional(),
  problemIndex: z.string().optional(),
  problemSlug: z.string().optional(),
});

export type IndexEntry = z.infer<typeof IndexEntrySchema>;

// ---------------------------------------------------------------------------
// 2. ARCHIVE ENTRY (Read model — used by Archive, filterEngine)
//    Maps to a SolvedProblem row (unique per userId+problemSlug).
//    The `id` field is the SolvedProblem.id (not a Submission.id).
// ---------------------------------------------------------------------------
export const ArchiveEntrySchema = z.object({
  // SolvedProblem.id
  id: z.string(),

  // Problem metadata
  title: z.string(),
  problemSlug: z.string(),
  platform: z.enum(["leetcode", "codeforces", "hackerrank", "geeksforgeeks", "other"]),
  difficultyLabel: z.string().optional(),
  rating: z.number().optional(),

  // Community average difficulty for this problem (0-10). Null when no one has rated yet.
  difficulty: z.number().nullable(),

  // User's own difficulty rating (from the main SolvedProblem record)
  difficultyRating: z.number().nullable().optional(),

  tags: z.array(z.string()),
  username: z.string(),
  userId: z.string(),

  // When the user last touched this problem (re-solve / alternate)
  // This powers the "LAST ACTIVE" column and is the primary sort key.
  date: z.string(),           // YYYY-MM-DD in IST (lastAttemptedAt)
  timestamp: z.string(),      // ISO 8601 (lastAttemptedAt)
  lastAttemptedAt: z.string(), // ISO 8601 (same as timestamp, for clarity)

  // When the user first solved this problem
  firstSolvedAt: z.string(),  // ISO 8601


  // How many code submissions exist for this SolvedProblem (main + alternates)
  submissionCount: z.number(),

  // The ID of the first (main) submission — used for the "View" link
  mainSubmissionId: z.string().optional(),

  // Codeforces contest metadata (optional)
  contestId: z.string().optional(),
  problemIndex: z.string().optional(),
});

export type ArchiveEntry = z.infer<typeof ArchiveEntrySchema>;