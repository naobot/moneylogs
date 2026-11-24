/**
 * The evening reminder: pure rules for eveningReminder.ts, free of the SDK for root Vitest.
 *
 * Someone with push on who hasn't checked in today (no visit, no logged entry: the streak
 * marker's lastDay) gets one push in their evening, asking whether today was really a
 * no-spend day. Only people who've checked in within the last week: a phone that's gone
 * quiet for longer stops being nudged until they come back.
 *
 * Each person with a device carries `users.checkInReminderDueAt`, their next local
 * REMINDER_HOUR, so the hourly run reads only the people whose evening it is.
 */

import { dayBefore } from "./coins";
import { dayIn } from "./knickknacks";
import { wallClockToInstant } from "./logTimeline";

/** The local hour the reminder goes out (20:00), an hour after the email digest. */
export const REMINDER_HOUR = 20;
/** A run that's late by an hour or two still sends; after this hour, the day is let go. */
export const REMINDER_LAST_HOUR = 22;
/** No reminders once the last check-in is more than this many days back. */
export const REMINDER_LAPSE_DAYS = 7;

const isValidZone = (timezone: string): boolean => {
  try {
    new Intl.DateTimeFormat("en", { timeZone: timezone });
    return true;
  } catch {
    return false;
  }
};

const nextDay = (day: string): string => {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + 1)).toISOString().slice(0, 10);
};

/**
 * The next REMINDER_HOUR:00 after `now` in the user's zone, in ms (UTC for a missing or
 * unknown zone: they're never reminded, only rebooked).
 */
export const nextReminderAt = (now: number, timezone?: unknown): number => {
  const zone = typeof timezone === "string" && timezone && isValidZone(timezone) ? timezone : "UTC";
  const clock = `T${String(REMINDER_HOUR).padStart(2, "0")}:00`;
  const at = (day: string) =>
    wallClockToInstant(`${day}${clock}`, zone) ?? wallClockToInstant(`${day}${clock}`, "UTC")!;
  const today = dayIn(now, zone);
  const tonight = at(today);
  return tonight > now ? tonight : at(nextDay(today));
};

/** The hour (0–23) in `timezone` at `now`. */
export const hourIn = (now: number, timezone: string): number => {
  const hour = new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone,
    hour: "2-digit",
    hourCycle: "h23",
  }).format(now);
  return Number(hour);
};

export type ReminderInput = {
  now: number;
  /** users.timezone. Without one there's no evening to aim for, so nobody is reminded. */
  timezone: unknown;
  /** users.checkInReminder: false turns it off; unset is on. */
  optIn: unknown;
  /** users/{id}/buddy/streak lastDay: the last day they checked in. */
  lastDay: unknown;
  /** users/{id}/buddy/streak remindedDay: the last day a reminder went out. */
  remindedDay: unknown;
};

/** The local day to remind for, or null when no reminder is due now. */
export const reminderDay = ({
  now,
  timezone,
  optIn,
  lastDay,
  remindedDay,
}: ReminderInput): string | null => {
  if (optIn === false) return null;
  if (typeof timezone !== "string" || !timezone || !isValidZone(timezone)) return null;
  const hour = hourIn(now, timezone);
  if (hour < REMINDER_HOUR || hour > REMINDER_LAST_HOUR) return null;

  const today = dayIn(now, timezone);
  if (remindedDay === today) return null;
  if (typeof lastDay !== "string" || !lastDay) return null;
  if (lastDay >= today) return null;

  let cutoff = today;
  for (let i = 0; i < REMINDER_LAPSE_DAYS; i++) cutoff = dayBefore(cutoff);
  return lastDay >= cutoff ? today : null;
};

/** The push itself. Push copy is sentence case, like pushCopy.ts. */
export const REMINDER_COPY = {
  title: "moneylogs",
  body: "Nothing logged today. Spent anything? Add it, or tell your buddy it was a no-spend day.",
} as const;

/**
 * Where a tap opens: the personal log, whose add form has "nothing spent today", or
 * home for someone without one.
 */
export const reminderPath = (personalLedgerId: unknown): string =>
  typeof personalLedgerId === "string" && /^[A-Za-z0-9_-]{1,128}$/.test(personalLedgerId)
    ? `/l/${personalLedgerId}`
    : "/";
