/**
 * Central date utility for IST (Indian Standard Time, UTC+5:30).
 * All date logic in DSApline should use these helpers to ensure
 * consistent timezone behavior for Indian users.
 */

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000; // +5:30

/** Convert a Date to IST date string (YYYY-MM-DD) */
export function toISTDateString(date: Date): string {
  const istDate = new Date(date.getTime() + IST_OFFSET_MS);
  return istDate.toISOString().split("T")[0];
}

/** Get today's date in IST as YYYY-MM-DD */
export function todayIST(): string {
  return toISTDateString(new Date());
}

/** Get yesterday's date in IST as YYYY-MM-DD */
export function yesterdayIST(): string {
  return toISTDateString(new Date(Date.now() - 86400000));
}

/** Format a date for display in IST (date only) */
export function formatISTDate(date: Date | string): string {
  return new Date(date).toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata" });
}

/** Format a date for display in IST (date + time) */
export function formatISTDateTime(date: Date | string): string {
  return new Date(date).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" });
}
