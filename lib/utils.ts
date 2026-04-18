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