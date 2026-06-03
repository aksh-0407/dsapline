/**
 * lib/constants.ts
 *
 * Shared, app-wide constants. Keeping these in one place prevents the same
 * list drifting out of sync between the submit form, comment composer, and
 * the difficulty/tag pickers.
 */

/**
 * Languages offered in language pickers (submit form, comment code blocks).
 * These are display/highlight hints only — they are not validated server-side.
 */
export const CODE_LANGUAGES = [
  "cpp", "python", "java", "javascript", "typescript",
  "c", "go", "rust", "kotlin", "swift", "sql", "other",
] as const;

/**
 * The built-in tag suggestions shown in the tag picker before any
 * community/custom tags are merged in.
 */
export const PREDEFINED_TAGS = [
  "Array", "String", "Hash Table", "DP", "Math",
  "Two Pointers", "Binary Search", "Greedy", "Stack",
  "Graph", "Recursion", "Linked List", "Tree",
] as const;
