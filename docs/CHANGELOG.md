# Changelog

All notable changes to the DSApline project will be documented in this file.

## [2026-04-18] - Architecture Finalization & UX Enhancements

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
