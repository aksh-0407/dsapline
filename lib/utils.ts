import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Converts a problem title (or any string) to a URL-safe slug.
 * Used by submit, parse-url, and migrate routes to guarantee consistent
 * slug generation regardless of where the call originates.
 *
 * Examples:
 *   "1. Two Sum"            → "1-two-sum"
 *   "33. Search in Rotated" → "33-search-in-rotated"
 *   "Problem /abc/"         → "problem-abc"
 */
export function titleToSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

/**
 * Resolve a clean, human-readable display name for a Clerk user.
 *
 * Clerk's firstName/lastName can be null (e.g. email-only signups), which made
 * the old `${firstName} ${lastName}` template produce "null" or empty strings,
 * and the downstream `?? userId` fallbacks leaked raw Clerk IDs (user_2ab...)
 * onto public profiles. This guarantees a presentable name is always stored:
 * "First Last" → email local-part → finally the id (only if there's no email).
 */
export function resolveDisplayName(
  firstName: string | null | undefined,
  lastName: string | null | undefined,
  email: string | null | undefined,
  fallbackId: string
): string {
  const name = [firstName, lastName].filter(Boolean).join(" ").trim();
  if (name) return name;
  if (email && email.includes("@")) {
    const local = email.split("@")[0].trim();
    if (local) return local;
  }
  return fallbackId;
}