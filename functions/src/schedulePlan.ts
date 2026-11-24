/**
 * Scheduled payments: pure rules shared by the Cloud Functions (scheduledEntries.ts) and the
 * client (src/utils/schedules.ts). Free of the SDK, so they run in the root Vitest suite.
 *
 * A fixed category (rent, bills, subscriptions) can hold scheduled payments, each a named
 * amount that repeats monthly on a day or yearly on a date. On the due day, around
 * LOG_HOUR in the owner's timezone, the server logs it as an entry for them.
 *
 * Due days are wall-clock "YYYY-MM-DD" days in the owner's zone, like entries' `date`.
 */

import { isFixedCategory } from "./ledgerBudget";
import { isActiveSublog, LinkableCategory } from "./ledgerRollup";
import { wallClockToInstant } from "./logTimeline";
import { nextDay, zoneOrUtc } from "./zones";

export type ScheduleRepeat =
  | { every: "month"; day: number }
  | { every: "year"; month: number; day: number };

/** What the owner sets; the rest of the doc (owner, next due, …) is filled in around it. */
export type ScheduleInput = {
  categoryId: string;
  label: string;
  amount: number;
  currency: string;
  repeat: ScheduleRepeat;
};

/** The local hour a due payment is logged: a morning, so its push doesn't wake anyone. */
export const LOG_HOUR = 8;
/** Mirrors the schedules rule in firestore.rules. */
export const MAX_SCHEDULE_LABEL_LENGTH = 40;
/** Rules can't count docs, so this is the UI's cap per category. */
export const MAX_SCHEDULES_PER_CATEGORY = 20;
/**
 * At most this many missed days are logged at once (the latest ones), so a long outage or
 * a long pause can't flood the ledger.
 */
export const CATCH_UP_CAP = 3;
/** Mirrors MAX_BUDGET_AMOUNT (ledgerBudget.ts). */
export const MAX_SCHEDULE_AMOUNT = 1_000_000_000;

const CURRENCY_RE = /^[A-Z]{3}$/;
const DAY_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

const pad = (n: number) => String(n).padStart(2, "0");

export const daysInMonth = (year: number, month: number): number =>
  new Date(Date.UTC(year, month, 0)).getUTCDate();

const isInt = (n: unknown, min: number, max: number): n is number =>
  typeof n === "number" && Number.isInteger(n) && n >= min && n <= max;

export const isScheduleRepeat = (raw: unknown): raw is ScheduleRepeat => {
  if (!raw || typeof raw !== "object") return false;
  const r = raw as Record<string, unknown>;
  if (r.every === "month") return Object.keys(r).length === 2 && isInt(r.day, 1, 31);
  if (r.every === "year") {
    return (
      Object.keys(r).length === 3 &&
      isInt(r.month, 1, 12) &&
      isInt(r.day, 1, daysInMonth(2024, r.month as number))
    );
  }
  return false;
};

/**
 * The due day in a given month, or null when the schedule isn't due that month (a yearly
 * one in any other month). The day is clamped to the month's length: the 31st falls on
 * the 30th in April and the 28th in February, and 29 Feb on the 28th outside leap years.
 */
export const occurrenceOn = (
  repeat: ScheduleRepeat,
  year: number,
  month: number,
): string | null => {
  if (repeat.every === "year" && repeat.month !== month) return null;
  const day = Math.min(repeat.day, daysInMonth(year, month));
  return `${year}-${pad(month)}-${pad(day)}`;
};

/** The first due day on or after `day` ("YYYY-MM-DD"). */
export const firstDue = (repeat: ScheduleRepeat, day: string): string => {
  const m = DAY_RE.exec(day);
  if (!m) throw new Error(`Bad day: ${day}`);
  let year = Number(m[1]);
  let month = Number(m[2]);
  // Within 13 months there's always one: monthly this month or next, yearly within a year.
  for (let i = 0; i < 14; i++) {
    const due = occurrenceOn(repeat, year, month);
    if (due && due >= day) return due;
    month += 1;
    if (month > 12) {
      month = 1;
      year += 1;
    }
  }
  throw new Error("No occurrence found");
};

/** The first due day strictly after `day`. */
export const nextOccurrence = (repeat: ScheduleRepeat, day: string): string =>
  firstDue(repeat, nextDay(day));

/** The instant (ms) of LOG_HOUR on `day` in the zone (UTC when it's missing or unknown). */
export const dueInstant = (day: string, timezone?: unknown): number => {
  const clock = `${day}T${pad(LOG_HOUR)}:00`;
  return wallClockToInstant(clock, zoneOrUtc(timezone)) ?? wallClockToInstant(clock, "UTC")!;
};

/**
 * What a run does with a schedule whose `nextDue` has come: the days to log (each due day
 * from nextDue through today, keeping only the latest CATCH_UP_CAP) and the next due day
 * after today. Nothing to log when nextDue is still ahead (an early run, or the owner
 * moved timezones): the booking is just left as it is.
 */
export const dueDays = (
  repeat: ScheduleRepeat,
  nextDue: string,
  today: string,
  cap: number = CATCH_UP_CAP,
): { days: string[]; next: string } => {
  if (nextDue > today) return { days: [], next: nextDue };
  const days: string[] = [];
  for (let day = nextDue; day <= today; day = nextOccurrence(repeat, day)) days.push(day);
  return { days: days.slice(-cap), next: nextOccurrence(repeat, today) };
};

/** The entry a schedule logs on a day: a fixed id, so a rerun can't log it twice. */
export const scheduleEntryId = (scheduleId: string, day: string): string => `${scheduleId}_${day}`;

/**
 * Should recomputeLedgerMonth skip the rewards for this write? Only the creation of a
 * scheduled entry: nobody logged it by hand, so it's no check-in, no roll, and it doesn't
 * undo a confirmed no-spend day. Its month still recomputes and alerts as usual.
 */
export const isScheduledCreate = (
  before: unknown,
  after: { scheduleId?: unknown } | undefined,
): boolean => !before && typeof after?.scheduleId === "string";

/** Why a schedule can't be saved, or undefined when it can. */
export const scheduleInputError = (input: Partial<ScheduleInput>): string | undefined => {
  const label = input.label?.trim() ?? "";
  if (!label) return "give it a name";
  if (label.length > MAX_SCHEDULE_LABEL_LENGTH) {
    return `keep the name under ${MAX_SCHEDULE_LABEL_LENGTH} characters`;
  }
  const { amount } = input;
  if (typeof amount !== "number" || !Number.isFinite(amount) || amount <= 0) {
    return "enter an amount";
  }
  if (amount > MAX_SCHEDULE_AMOUNT) return "that amount is too large";
  if (typeof input.currency !== "string" || !CURRENCY_RE.test(input.currency)) {
    return "pick a currency";
  }
  if (!isScheduleRepeat(input.repeat)) return "pick when it repeats";
  if (typeof input.categoryId !== "string" || !input.categoryId) return "pick a category";
  return undefined;
};

/** A stored schedule as the server reads it, or null when it's malformed. */
export type ParsedSchedule = ScheduleInput & {
  ownerUid: string;
  ownerDocId: string;
  paused: boolean;
  nextDue?: string;
};

export const parseSchedule = (raw: unknown): ParsedSchedule | null => {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const input = {
    categoryId: r.categoryId,
    label: r.label,
    amount: r.amount,
    currency: r.currency,
    repeat: r.repeat,
  } as Partial<ScheduleInput>;
  if (scheduleInputError(input)) return null;
  if (typeof r.ownerUid !== "string" || !r.ownerUid) return null;
  if (typeof r.ownerDocId !== "string" || !r.ownerDocId) return null;
  return {
    ...(input as ScheduleInput),
    label: (input.label as string).trim(),
    ownerUid: r.ownerUid,
    ownerDocId: r.ownerDocId,
    paused: r.paused === true,
    ...(typeof r.nextDue === "string" && DAY_RE.test(r.nextDue) ? { nextDue: r.nextDue } : {}),
  };
};

type ScheduleCategory = Pick<LinkableCategory, "sublog"> & {
  id?: unknown;
  name?: unknown;
  archived?: boolean;
  fixed?: boolean;
};

/**
 * Whether a schedule's category can still take its payments: "log" when it can, "pause"
 * when it's archived, no longer fixed or now filled by a sublog (the owner can pick it
 * back up), "drop" when the category is gone for good.
 */
export const scheduleCategoryState = (
  categories: ReadonlyArray<ScheduleCategory>,
  categoryId: string,
): "log" | "pause" | "drop" => {
  const category = categories.find((c) => c.id === categoryId);
  if (!category) return "drop";
  if (category.archived || isActiveSublog(category)) return "pause";
  if (!isFixedCategory({ id: categoryId, fixed: category.fixed })) return "pause";
  return "log";
};
