/**
 * lib/cache.ts
 *
 * Centralised Next.js Data Cache tag names and the single helper used to
 * invalidate them after a write.
 *
 * Several read models are wrapped in `unstable_cache` (dashboard analytics,
 * the global archive, the leaderboard). Those entries are NOT busted by
 * `revalidatePath` — they only refresh on their time-based `revalidate` or
 * when their tag is passed to `revalidateTag`. Without this, a fresh solve
 * could take up to 24h to appear. Every write path must therefore call
 * `revalidateAfterWrite(userId)`.
 *
 * Next.js 16 requires a cache-life profile as the second `revalidateTag`
 * argument; `"max"` is the documented replacement for the old single-arg call
 * (the tag is purged regardless of profile). `updateTag` is not usable here —
 * it throws outside Server Actions, and these run inside Route Handlers.
 */
import { revalidateTag } from "next/cache";

const PROFILE = "max";

/** Per-user dashboard analytics (stats, streaks, heatmap, recent activity). */
export const dashboardTag = (userId: string) => `dashboard-${userId}`;

/** The global archive feed (one row per solved problem, all users). */
export const ARCHIVE_TAG = "global-archive";

/** The leaderboard ranking data. */
export const LEADERBOARD_TAG = "leaderboard-data";

/**
 * Invalidate every cached read model affected by a user's write
 * (submit / edit / delete). Safe to over-invalidate — these are cheap to
 * rebuild and only rebuild on next request.
 */
export function revalidateAfterWrite(userId: string): void {
  revalidateTag(dashboardTag(userId), PROFILE);
  revalidateTag(ARCHIVE_TAG, PROFILE);
  revalidateTag(LEADERBOARD_TAG, PROFILE);
}
