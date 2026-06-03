# Changelog

All notable changes to the DSApline project are documented in this file.

## As of [2026-06-03] - UI, Profiles & Performance

### Added
- **Brand logo** in the navbar and landing hero, rendered via `next/image`
  (optimised/responsive) using `public/logo_nobg_small.png`.
- **Activity heatmap on user profiles** — the GitHub-style contribution graph
  (previously dashboard-only) now appears on every `/user/[userId]` page.
- **Landing page CTAs** — a "Get Started" Clerk sign-in modal trigger and a
  "Browse the archive" link (the archive is public).

### Changed
- **Sign-in now required for the whole app** — the Clerk middleware (`proxy.ts`)
  protects every page except the landing page; signed-out visitors to
  `/archive`, `/leaderboard`, `/submit`, `/problem/*`, `/submission/*`, and
  `/user/*` are redirected to the landing page (which hosts the sign-in modal).
  API routes still enforce their own auth.
- **Landing page rewrite** — copy reworked to be grounded and student-focused
  (dropped the "build a legacy / solving in a vacuum" marketing tone); badge now
  reads "v2.0 is now live"; single "Get Started" CTA.
- **Profiles no longer expose raw Clerk IDs** — the `user_2ab…` string is gone
  from profile pages; only the display name is shown.
- **Robust display names** — `resolveDisplayName()` (`lib/utils.ts`) guarantees a
  presentable name everywhere ("First Last" → email local-part → id), fixing
  names that previously rendered as `"null"`, empty, or a raw Clerk ID.

### Fixed
- **Code preview on problem pages** — the truncation hint
  (`// ... click 'View Full'`) was rendered *inside* the code block as if it were
  source. It's now a separate, clickable "N more lines · View full solution"
  footer below the snippet.

### Performance
- Parallelised independent DB reads on the **dashboard** (4 queries → one
  concurrent batch), **user profile** (stats + archive), and **problem** page
  (problem + submissions) — cutting wall-clock latency, which matters most on
  Neon cold starts.
- Removed a blocking user lookup from the dashboard's critical render path; the
  page shell now streams immediately while data loads in the Suspense boundary.
- Logo served through `next/image` instead of a multi-MB raw asset.

## As of [2026-06-03] - Pre-Launch Robustness Overhaul

A correctness, robustness, and consistency pass across the whole codebase ahead
of the public launch. **No database schema changes** — existing data is fully
compatible (no `db push` / migration required).

### Fixed
- **Stale data after writes (critical):** the dashboard, leaderboard, and archive
  are served from `unstable_cache` entries that `revalidatePath` does not bust,
  so a fresh solve could take up to 24h to appear. Every write path now calls the
  new `revalidateAfterWrite()` helper, which purges the relevant cache tags
  (`lib/cache.ts`). The submit route had even imported `revalidateTag` without
  ever calling it.
- **Frozen leaderboard streaks:** `User.currentStreak` / `User.maxStreak` were only
  ever written by the migration, so the leaderboard streak ranking never updated.
  They are now recomputed and persisted on every submit/delete via
  `recomputeUserStreaks()` (`lib/streaks.ts`).
- **Phantom 5.0 difficulty:** the dashboard's Recent Activity showed a fake `5.0`
  for unrated problems (`difficultyValue ?? 5`); it now shows `—`, consistent with
  the Archive. `IndexEntry.difficulty` is now nullable.
- **Community-average difficulty never reset:** clearing the last rating (or deleting
  the last solution) left a stale `Problem.difficultyValue`. The recompute helper
  now writes the average even when it is `null`.
- **Sign-in 404:** `/submit` redirected logged-out users to a non-existent
  `/sign-in` route; it now redirects to the landing page (which hosts the modal
  Sign In button).
- **Lost "main" solution on delete:** deleting the main submission of a multi-solution
  problem left it with no main (no Archive "View" link). The oldest remaining
  submission is now promoted to main.
- **Migration footgun (critical):** `/api/migrate` cleared every table *before*
  reading the now-removed `data/` folder — i.e. triggering it wiped the live
  database and then 500'd. It now validates the source data first and aborts
  untouched if missing, and its `MIGRATE_SECRET` guard is fail-closed in production.

### Added
- **Atomic writes:** submit, edit, and delete now run inside `prisma.$transaction`,
  so a mid-operation failure can no longer leave `totalSolved`, `SolvedProblem`, and
  `Submission` rows out of sync. (External API enrichment stays outside the
  transaction.)
- **Language selector on the submit form:** pasted solutions were saved as `txt`;
  a language dropdown (default `cpp`) now sets the language for pasted code, while
  uploaded files keep their real extension.
- **Input hardening:** pasted-code length cap (1M chars), defensive tag parsing,
  tag count/length caps, and `URL`-based parsing for LeetCode/Codeforces links so
  query strings and trailing slashes can't corrupt slugs/indexes.

### Changed
- **DRY shared modules:** `lib/cache.ts` (cache tags), `lib/streaks.ts` (streak math
  + recompute), `lib/problem-stats.ts` (community average), and `lib/constants.ts`
  (`CODE_LANGUAGES`, `PREDEFINED_TAGS`). Duplicated copies in the submit/submission/
  migrate routes, analytics, the submit/edit forms, and the comment composer now
  import these single sources of truth.
- Leaderboard cache backstop reduced from 24h to 5min (now primarily busted on write).

## As of [2026-04-18] - Architecture Finalization & UX Enhancements

### Added
- **Code Blocks in Comments**: Added `codeSnippet` and `codeLanguage` fields to the `Comment` schema, allowing users to share syntax-highlighted code blocks separately from prose in discussion threads.
- **API Timeout Guards**: Added a strict 5000ms `AbortSignal.timeout` to LeetCode and Codeforces external API requests to prevent infinite hanging when external services are down.
- **Migration Security**: Guarded the `/api/migrate` endpoint with a `MIGRATE_SECRET` environment variable to prevent unauthorized execution of ETL processes in production.
- **Solution Titles**: Added the ability for users to explicitly name/label their alternate solutions directly in the UI (`EditSubmission.tsx`).

### Changed
- **Canonical Solved Metrics**: Completed the transition to the new `SolvedProblem` metric architecture. The platform now accurately deduplicates multiple alternate solutions, counting them as exactly one "Total Problem Solved".
- **Historical Sorting**: Refactored the `lastAttemptedAt` field in `SolvedProblem` from an auto-updating Prisma field (`@updatedAt`) to a manually managed timestamp (`@default(now())`). This enables accurate preservation of historical dates during migrations and guarantees correct chronological sorting in the Archive.
- **Archive UI Updates**: Renamed the Archive's date column to "LAST ACTIVE" to better reflect the underlying `lastAttemptedAt` sorting key.
- **UX - Submit Form**: Implemented a 1-second debounced auto-enrichment on the URL field to prevent excessive API calls while typing.
- **UX - Error Handling**: Replaced blocking browser `alert()` pop-ups in the Submit flow with animated, inline dismissable UI banners for a more professional feel.

### Fixed
- **Archive Key Warning**: Fixed a React rendering warning by extracting archive rows into an `ArchiveRow` component, allowing the `key` prop to correctly attach to the DOM `<tr>` element.
- **Slug Consistency**: Introduced a shared `titleToSlug()` utility to guarantee exact matches between manual submission slugs and external API enrichment slugs.
- **Tag Pool Persistence**: Fixed a bug in the Edit Submission view where unselected tags would disappear from the pool.
- **Deletion Integrity**: Added an arithmetic floor guard (`totalSolved: { gt: 0 }`) to the DELETE `/api/submission/[id]` route to prevent the total solved count from dropping below zero.
