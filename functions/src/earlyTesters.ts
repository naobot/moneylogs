/**
 * Early tester gears: pure rules for checkIn.ts and awardEarlyTesters.ts, free of the SDK
 * for root Vitest.
 *
 * The Play closed test runs between config/app.testerWindow.from and .to (Timestamps, set
 * in the console). Every day someone checks in from the Android app inside that window is
 * counted at users/{id}/testing/android. When the window closes, each of them gets one
 * gear: the extra shiny gear for 14 Android days in a row, the shiny gear otherwise.
 */

import { nextStreak } from "./coins";
import { EARLY_TESTER, EARLY_TESTER_EXTRA } from "./milestones";

/** Android days in a row that earn the extra shiny gear instead of the shiny gear. */
export const EXTRA_SHINY_DAYS = 14;

export type TesterWindow = { from: number; to: number; awardedAt: number | null };

/** users/{id}/testing/android */
export type TesterMarker = {
  /** The first day ("YYYY-MM-DD", the person's timezone) with an Android check-in. */
  firstDay?: string;
  /** The last such day. */
  lastDay?: string;
  /** Android days in a row up to and including lastDay. */
  days?: number;
  /** The longest run of Android days in a row so far. */
  bestRun?: number;
};

export type CheckInPlatform = "android" | "ios" | "web";

/** Firestore Timestamps (or anything with toMillis) and plain millis. */
const toMillis = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const fn = (value as { toMillis?: unknown } | null)?.toMillis;
  return typeof fn === "function" ? (fn.call(value) as number) : null;
};

/** config/app.testerWindow, or null while it isn't set up (nothing is counted or given). */
export const parseTesterWindow = (data: unknown): TesterWindow | null => {
  const raw = (data as { testerWindow?: unknown } | null | undefined)?.testerWindow;
  if (!raw || typeof raw !== "object") return null;
  const fields = raw as Record<string, unknown>;
  const from = toMillis(fields.from);
  const to = toMillis(fields.to);
  if (from === null || to === null || to <= from) return null;
  return { from, to, awardedAt: toMillis(fields.awardedAt) };
};

/** Whether a check-in at `now` counts towards the test. */
export const inWindow = (window: TesterWindow | null, now: number): boolean =>
  !!window && now >= window.from && now < window.to;

/** Whether the window has closed and its gears are still to be given. */
export const dueForAwards = (window: TesterWindow | null, now: number): boolean =>
  !!window && now >= window.to && window.awardedAt === null;

/**
 * The marker after an Android check-in on `today`, or null when it changes nothing (the
 * same day again, or a day earlier than the last after a timezone change).
 */
export const nextTesterMarker = (
  marker: TesterMarker | undefined | null,
  today: string,
): Required<TesterMarker> | null => {
  const next = nextStreak(marker, today);
  if (!next) return null;
  return {
    firstDay: marker?.firstDay ?? today,
    lastDay: next.lastDay,
    days: next.days,
    bestRun: Math.max(marker?.bestRun ?? 0, next.days),
  };
};

/** The one gear a tester gets when the window closes. */
export const testerGear = (marker: TesterMarker | undefined | null) =>
  (marker?.bestRun ?? 0) >= EXTRA_SHINY_DAYS ? EARLY_TESTER_EXTRA : EARLY_TESTER;

/** The two gears: whoever holds one never gets the other. */
export const TESTER_GEARS = [EARLY_TESTER, EARLY_TESTER_EXTRA] as const;

/** Where the app says it's running. Older clients send nothing: null. */
export const parseCheckInPlatform = (data: unknown): CheckInPlatform | null => {
  const platform = (data as { platform?: unknown } | null | undefined)?.platform;
  return platform === "android" || platform === "ios" || platform === "web" ? platform : null;
};
