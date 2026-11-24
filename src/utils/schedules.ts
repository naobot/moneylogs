import { LedgerSchedule } from "@/types/ledger";
import { Currency } from "@/types/user";
import { parseAmount } from "@/utils/ledgerEntries";
// Shared with the Cloud Functions, so the form checks what the hourly run will accept.
import {
  daysInMonth,
  MAX_SCHEDULE_LABEL_LENGTH,
  MAX_SCHEDULES_PER_CATEGORY,
  ScheduleInput,
  scheduleInputError,
  ScheduleRepeat,
} from "../../functions/src/schedulePlan";

export { MAX_SCHEDULE_LABEL_LENGTH, MAX_SCHEDULES_PER_CATEGORY, scheduleInputError };
export type { ScheduleInput, ScheduleRepeat };

export const MONTH_NAMES = [
  "jan",
  "feb",
  "mar",
  "apr",
  "may",
  "jun",
  "jul",
  "aug",
  "sep",
  "oct",
  "nov",
  "dec",
] as const;

/** 1 → "1st", 22 → "22nd", 13 → "13th". */
export const ordinal = (n: number): string => {
  const teen = n % 100 >= 11 && n % 100 <= 13;
  const suffix = teen ? "th" : ({ 1: "st", 2: "nd", 3: "rd" } as Record<number, string>)[n % 10];
  return `${n}${suffix ?? "th"}`;
};

/** "monthly · 5th", "yearly · 12 mar". */
export const describeRepeat = (repeat: ScheduleRepeat): string =>
  repeat.every === "month"
    ? `monthly · ${ordinal(repeat.day)}`
    : `yearly · ${repeat.day} ${MONTH_NAMES[repeat.month - 1]}`;

/** "2026-12-05" → "5 dec", with the year only when it isn't `thisYear`. */
export const formatDueDay = (day: string, thisYear?: string): string => {
  const [y, m, d] = day.split("-");
  const short = `${Number(d)} ${MONTH_NAMES[Number(m) - 1]}`;
  return thisYear && y !== thisYear ? `${short} ${y}` : short;
};

/** The days a repeat can fall on: up to 31 monthly (clamped later), the month's days yearly. */
export const dayChoices = (repeat: ScheduleRepeat): number[] =>
  Array.from(
    { length: repeat.every === "month" ? 31 : daysInMonth(2024, repeat.month) },
    (_, i) => i + 1,
  );

/** What the schedule form holds while it's being typed into. */
export type ScheduleFormValues = {
  label: string;
  amount: string;
  currency: Currency;
  repeat: ScheduleRepeat;
};

export const emptyScheduleForm = (currency: Currency): ScheduleFormValues => ({
  label: "",
  amount: "",
  currency,
  repeat: { every: "month", day: 1 },
});

export const scheduleFormOf = (s: LedgerSchedule): ScheduleFormValues => ({
  label: s.label,
  amount: String(s.amount),
  currency: s.currency,
  repeat: s.repeat,
});

/** Switching monthly ↔ yearly keeps the day, clamped to what the new repeat allows. */
export const switchRepeat = (repeat: ScheduleRepeat, every: "month" | "year"): ScheduleRepeat => {
  if (every === repeat.every) return repeat;
  if (every === "month") return { every: "month", day: repeat.day };
  const month = 1;
  return { every: "year", month, day: Math.min(repeat.day, daysInMonth(2024, month)) };
};

/** A yearly repeat moved to another month: its day clamped to that month (29 Feb allowed). */
export const withMonth = (repeat: ScheduleRepeat, month: number): ScheduleRepeat =>
  repeat.every === "year"
    ? { every: "year", month, day: Math.min(repeat.day, daysInMonth(2024, month)) }
    : repeat;

export const withDay = (repeat: ScheduleRepeat, day: number): ScheduleRepeat => ({
  ...repeat,
  day,
});

export const toScheduleInput = (
  categoryId: string,
  values: ScheduleFormValues,
): Partial<ScheduleInput> => ({
  categoryId,
  label: values.label.trim(),
  amount: parseAmount(values.amount),
  currency: values.currency,
  repeat: values.repeat,
});

/** The form's problem, or undefined when it can be saved. */
export const scheduleFormError = (categoryId: string, values: ScheduleFormValues) =>
  scheduleInputError(toScheduleInput(categoryId, values));

/** Schedules per category id, each category's by name. */
export const schedulesByCategory = (
  schedules: ReadonlyArray<LedgerSchedule>,
): Map<string, LedgerSchedule[]> => {
  const out = new Map<string, LedgerSchedule[]>();
  const sorted = [...schedules].sort((a, b) => a.label.localeCompare(b.label));
  for (const s of sorted) out.set(s.categoryId, [...(out.get(s.categoryId) ?? []), s]);
  return out;
};
