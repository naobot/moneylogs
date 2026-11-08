import dayjs from "@/utils/configuredDayjs";
import { isCurrency } from "@/utils/currency";
import { Ledger, LedgerCategory, LedgerEntryInput } from "@/types/ledger";

export const MAX_CATEGORY_NAME_LENGTH = 20;
export const MAX_NOTE_LENGTH = 140;
export const MAX_LEDGER_TITLE_LENGTH = 20;

const DATE_RE = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;
const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

const DEFAULT_CATEGORY_NAMES = [
  "Food",
  "Groceries",
  "Transport",
  "Housing",
  "Utilities",
  "Shopping",
  "Entertainment",
  "Health",
  "Travel",
  "Other",
];

export const DEFAULT_CATEGORIES: ReadonlyArray<LedgerCategory> = DEFAULT_CATEGORY_NAMES.map(
  (name, order) => ({ id: name.toLowerCase(), name, order }),
);

export const isValidDateKey = (date: string): boolean =>
  DATE_RE.test(date) && dayjs(date).format("YYYY-MM-DD") === date;

export const isValidMonthKey = (month: string): boolean => MONTH_RE.test(month);

/** "YYYY-MM" for a "YYYY-MM-DD" date key. */
export const monthKeyOf = (date: string): string => date.slice(0, 7);

/** Today's wall-clock date ("YYYY-MM-DD") in the given timezone (browser tz if absent). */
export const todayInTz = (tz?: string | null, now: number = Date.now()): string => {
  try {
    return (tz ? dayjs(now).tz(tz) : dayjs(now)).format("YYYY-MM-DD");
  } catch {
    return dayjs(now).format("YYYY-MM-DD");
  }
};

/** Shift a "YYYY-MM" month key by `delta` months. */
export const shiftMonth = (month: string, delta: number): string =>
  dayjs(`${month}-01`).add(delta, "month").format("YYYY-MM");

/** The `count` month keys ending at (and including) `month`, oldest first. */
export const trailingMonths = (month: string, count: number): string[] =>
  Array.from({ length: count }, (_, i) => shiftMonth(month, i - (count - 1)));

export const formatMonth = (month: string): string => dayjs(`${month}-01`).format("MMM YYYY");

/** Trim and collapse internal whitespace. */
export const normaliseCategoryName = (name: string): string => name.trim().replace(/\s+/g, " ");

export const sortCategories = (categories: ReadonlyArray<LedgerCategory>): LedgerCategory[] =>
  [...categories].sort((a, b) => a.order - b.order);

/** Non-archived categories in display order. */
export const activeCategories = (categories: ReadonlyArray<LedgerCategory>): LedgerCategory[] =>
  sortCategories(categories.filter((c) => !c.archived));

/** Look a category up by id; unknown ids resolve to a placeholder so old entries still render. */
export const resolveCategory = (
  id: string,
  categories: ReadonlyArray<LedgerCategory>,
): LedgerCategory =>
  categories.find((c) => c.id === id) ?? { id, name: "Uncategorised", order: Infinity };

export type EntryValidationError = "amount" | "currency" | "category" | "date" | "note";

/**
 * Validate an entry against the ledger's categories. Returns the list of invalid fields
 * (empty when valid). Mirrors the checks in firestore.rules.
 */
export const validateEntry = (
  entry: Partial<LedgerEntryInput>,
  categories: ReadonlyArray<LedgerCategory>,
): EntryValidationError[] => {
  const errors: EntryValidationError[] = [];
  if (typeof entry.amount !== "number" || !Number.isFinite(entry.amount) || entry.amount <= 0) {
    errors.push("amount");
  }
  if (!isCurrency(entry.currency)) errors.push("currency");
  const category = categories.find((c) => c.id === entry.categoryId);
  // Archived categories are allowed so existing entries can still be edited.
  if (!category) errors.push("category");
  if (typeof entry.date !== "string" || !isValidDateKey(entry.date)) errors.push("date");
  if (entry.note !== undefined && entry.note.length > MAX_NOTE_LENGTH) errors.push("note");
  return errors;
};

/** Remaining member slots (never negative). */
export const spotsLeft = (ledger: Pick<Ledger, "max_participants" | "memberUids">): number =>
  Math.max(0, ledger.max_participants - (ledger.memberUids?.length ?? 0));

/**
 * Newest first by createdAt. A just-created ledger has a pending (null) server timestamp
 * in its first local snapshot, so treat a missing createdAt as "now" to keep it on top.
 */
export const sortLedgersNewestFirst = <T extends Pick<Ledger, "createdAt">>(
  ledgers: ReadonlyArray<T>,
): T[] => {
  const millis = (l: T) => l.createdAt?.toMillis?.() ?? Number.POSITIVE_INFINITY;
  return [...ledgers].sort((a, b) => millis(b) - millis(a));
};
