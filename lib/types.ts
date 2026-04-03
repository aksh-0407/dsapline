/**
 * lib/types.ts
 *
 * Active TypeScript types for DSApline V2.
 * The legacy JSON-era Zod schemas (UserSchema, SubmissionSchema) have been
 * removed — all data now flows through Prisma's generated types.
 *
 * IndexEntry is the lightweight read-model used by the Archive, Dashboard,
 * and filterEngine. It is constructed by archive.ts / analytics.ts from raw
 * Prisma results.
 */

import { z } from "zod";

// ---------------------------------------------------------------------------
// 1. INDEX ENTRY (Read model — used by Archive, Dashboard, filterEngine)
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