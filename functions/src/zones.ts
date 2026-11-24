/** Small calendar helpers for code that works in a user's own timezone. */

/** Whether Intl knows the zone (a stale or hand-typed one falls back to UTC). */
export const isValidZone = (timezone: string): boolean => {
  try {
    new Intl.DateTimeFormat("en", { timeZone: timezone });
    return true;
  } catch {
    return false;
  }
};

/** A usable zone: the given one when Intl knows it, else UTC. */
export const zoneOrUtc = (timezone?: unknown): string =>
  typeof timezone === "string" && timezone && isValidZone(timezone) ? timezone : "UTC";

/** The "YYYY-MM-DD" after `day`. */
export const nextDay = (day: string): string => {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + 1)).toISOString().slice(0, 10);
};
