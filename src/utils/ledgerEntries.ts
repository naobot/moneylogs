import dayjs from "@/utils/configuredDayjs";
import { Currency } from "@/types/user";
import { CurrencyAmounts, LedgerEntry, LedgerEntryInput } from "@/types/ledger";
import { CURRENCIES } from "@/utils/currency";
import { monthKeyOf } from "@/utils/ledger";
import { formatDate } from "@/utils/dateFormat";

type Timestamped = { createdAt?: { toMillis?: () => number } | null };

// Pending server timestamps (a just-written entry) count as "now" so they sort first.
const createdMillis = (e: Timestamped) => e.createdAt?.toMillis?.() ?? Number.POSITIVE_INFINITY;

/** Newest day first; within a day, most recently added first. Does not mutate. */
export const sortEntries = <T extends Pick<LedgerEntry, "date"> & Timestamped>(
  entries: ReadonlyArray<T>,
): T[] =>
  [...entries].sort((a, b) =>
    a.date === b.date ? createdMillis(b) - createdMillis(a) : a.date < b.date ? 1 : -1,
  );

/** Sum amounts per currency. Floating-point noise is rounded to 2dp. */
export const sumByCurrency = (
  entries: ReadonlyArray<Pick<LedgerEntry, "amount" | "currency">>,
): CurrencyAmounts => {
  const totals: CurrencyAmounts = {};
  for (const { amount, currency } of entries) {
    totals[currency] = Math.round(((totals[currency] ?? 0) + amount) * 100) / 100;
  }
  return totals;
};

/** Currencies present in a totals map, in the app's standard currency order. */
export const orderedCurrencies = (totals: CurrencyAmounts): Currency[] =>
  CURRENCIES.filter((c) => totals[c] !== undefined);

export const formatAmount = (amount: number, currency: Currency): string =>
  `${amount.toLocaleString("en-US", { maximumFractionDigits: 2 })} ${currency}`;

/** "12,000 JPY · 45.5 CAD" */
export const formatTotals = (totals: CurrencyAmounts): string =>
  orderedCurrencies(totals)
    .map((c) => formatAmount(totals[c]!, c))
    .join(" · ");

export type EntryDay<T> = {
  date: string; // YYYY-MM-DD
  label: string; // "Sun 8 Nov"
  entries: T[];
  subtotals: CurrencyAmounts;
};

/** Group entries into days (newest first), each with per-currency subtotals. */
export const groupEntriesByDay = <T extends LedgerEntry>(
  entries: ReadonlyArray<T>,
): EntryDay<T>[] => {
  const days: EntryDay<T>[] = [];
  for (const entry of sortEntries(entries)) {
    let day = days[days.length - 1];
    if (!day || day.date !== entry.date) {
      day = {
        date: entry.date,
        label: formatDate(dayjs(entry.date), { year: false }),
        entries: [],
        subtotals: {},
      };
      days.push(day);
    }
    day.entries.push(entry);
  }
  for (const day of days) day.subtotals = sumByCurrency(day.entries);
  return days;
};

/**
 * Default date for a new entry while viewing `month`: today if it's the current month,
 * otherwise the last day of a past month or the first day of a future one.
 */
export const defaultEntryDate = (month: string, today: string): string => {
  const todayMonth = monthKeyOf(today);
  if (month === todayMonth) return today;
  const first = dayjs(`${month}-01`);
  return month < todayMonth
    ? first.endOf("month").format("YYYY-MM-DD")
    : first.format("YYYY-MM-DD");
};

/** Parse a user-typed amount ("1,200", " 3.5 ") into a number, or NaN. */
export const parseAmount = (raw: string): number => {
  const cleaned = raw.replace(/[,\s]/g, "");
  if (!/^\d*\.?\d+$|^\d+\.$/.test(cleaned)) return NaN;
  return Number(cleaned);
};

/** Raw string values from the entry form. */
export type EntryFormValues = {
  amount: string;
  currency: Currency;
  categoryId: string;
  date: string;
  note: string;
};

/** Convert form strings to an entry input; the amount is NaN when it doesn't parse. */
export const toEntryInput = (values: EntryFormValues): LedgerEntryInput => ({
  amount: parseAmount(values.amount),
  currency: values.currency,
  categoryId: values.categoryId,
  date: values.date,
  note: values.note.trim() || undefined,
});
