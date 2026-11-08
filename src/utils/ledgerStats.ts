import dayjs from "@/utils/configuredDayjs";
import { Currency } from "@/types/user";
import { CurrencyAmounts, LedgerCategory, LedgerEntry, LedgerMonth } from "@/types/ledger";
import { CURRENCIES } from "@/utils/currency";
import { formatMonth, resolveCategory, shiftMonth } from "@/utils/ledger";
// Single source of truth for monthly aggregation, shared with the Cloud Function.
import { aggregateMonth, MonthAggregate } from "../../functions/src/ledgerAggregate";

export type { MonthAggregate };

/** Aggregate loaded entries exactly the way the backend builds month documents. */
export const aggregateEntries = (entries: ReadonlyArray<LedgerEntry>): MonthAggregate =>
  aggregateMonth(entries);

/** Currencies by number of entries (most first), ties in the standard picker order. */
export const currenciesByUse = (
  entries: ReadonlyArray<Pick<LedgerEntry, "currency">>,
): Currency[] => {
  const counts = new Map<Currency, number>();
  for (const { currency } of entries) counts.set(currency, (counts.get(currency) ?? 0) + 1);
  return CURRENCIES.filter((c) => counts.has(c)).sort(
    (a, b) => (counts.get(b) ?? 0) - (counts.get(a) ?? 0),
  );
};

export type Share = { id: string; name: string; amount: number; share: number };

const toShares = (
  buckets: Record<string, CurrencyAmounts>,
  currency: Currency,
  nameOf: (id: string) => string,
): Share[] => {
  const rows = Object.entries(buckets)
    .map(([id, amounts]) => ({ id, name: nameOf(id), amount: amounts[currency] ?? 0 }))
    .filter((r) => r.amount > 0);
  const total = rows.reduce((sum, r) => sum + r.amount, 0);
  return rows
    .map((r) => ({ ...r, share: total > 0 ? r.amount / total : 0 }))
    .sort((a, b) => b.amount - a.amount || a.name.localeCompare(b.name));
};

export const categoryShares = (
  agg: Pick<MonthAggregate, "byCategory">,
  currency: Currency,
  categories: ReadonlyArray<LedgerCategory>,
): Share[] => toShares(agg.byCategory, currency, (id) => resolveCategory(id, categories).name);

export const memberShares = (
  agg: Pick<MonthAggregate, "byMember">,
  currency: Currency,
  names: Record<string, string>,
): Share[] => toShares(agg.byMember, currency, (uid) => names[uid] ?? "Former member");

/** Days of `month` that have happened as of `today` (all of them for past months). */
export const elapsedDays = (month: string, today: string): number => {
  const days = dayjs(`${month}-01`).daysInMonth();
  const todayMonth = today.slice(0, 7);
  if (month < todayMonth) return days;
  if (month > todayMonth) return 0;
  return Number(today.slice(8, 10));
};

export type StatPoint = {
  key: string;
  date: dayjs.Dayjs;
  label: string;
  amount: number;
  cumulative: number;
  count?: number;
};

/** Zero-filled daily series for the month (up to today for the current month). */
export const dailySeries = (
  month: string,
  byDay: MonthAggregate["byDay"],
  currency: Currency,
  today: string,
): StatPoint[] => {
  const shown = Math.max(1, elapsedDays(month, today) || dayjs(`${month}-01`).daysInMonth());
  let cumulative = 0;
  return Array.from({ length: shown }, (_, i) => {
    const dd = String(i + 1).padStart(2, "0");
    const date = dayjs(`${month}-${dd}`);
    const amount = byDay[dd]?.[currency] ?? 0;
    cumulative = Math.round((cumulative + amount) * 100) / 100;
    return { key: `${month}-${dd}`, date, label: date.format("ddd D MMM"), amount, cumulative };
  });
};

/** One point per month (oldest first) from month totals; missing months are zero. */
export const monthlySeries = (
  months: ReadonlyArray<string>,
  totalsByMonth: Record<string, CurrencyAmounts | undefined>,
  currency: Currency,
): StatPoint[] => {
  let cumulative = 0;
  return months.map((month) => {
    const amount = totalsByMonth[month]?.[currency] ?? 0;
    cumulative = Math.round((cumulative + amount) * 100) / 100;
    const date = dayjs(`${month}-01`);
    return { key: month, date, label: formatMonth(month), amount, cumulative };
  });
};

/** Cumulative spend in `currency` up to and including day `throughDay` of a month. */
export const spentThroughDay = (
  byDay: MonthAggregate["byDay"] | undefined,
  currency: Currency,
  throughDay: number,
): number => {
  let sum = 0;
  for (const [dd, amounts] of Object.entries(byDay ?? {})) {
    if (Number(dd) <= throughDay) sum += amounts[currency] ?? 0;
  }
  return Math.round(sum * 100) / 100;
};

export type Insights = {
  topCategory?: Share;
  /** This month so far vs the same point last month (null when last month had nothing). */
  vsLastMonth: { current: number; previous: number; change: number | null } | null;
  noSpendDays: number;
  elapsed: number;
};

export const buildInsights = ({
  month,
  today,
  currency,
  agg,
  previous,
  categories,
}: {
  month: string;
  today: string;
  currency: Currency;
  agg: MonthAggregate;
  previous?: Pick<LedgerMonth, "byDay"> | null;
  categories: ReadonlyArray<LedgerCategory>;
}): Insights => {
  const elapsed = elapsedDays(month, today);
  const spentDays = Object.entries(agg.byDay).filter(
    ([dd, amounts]) => Number(dd) <= elapsed && Object.values(amounts).some((v) => (v ?? 0) > 0),
  ).length;

  let vsLastMonth: Insights["vsLastMonth"] = null;
  if (elapsed > 0 && previous) {
    // Compare like for like: the same number of days into the previous month.
    const prevDays = dayjs(`${shiftMonth(month, -1)}-01`).daysInMonth();
    const previousSpend = spentThroughDay(previous.byDay, currency, Math.min(elapsed, prevDays));
    const current = spentThroughDay(agg.byDay, currency, elapsed);
    vsLastMonth = {
      current,
      previous: previousSpend,
      change: previousSpend > 0 ? (current - previousSpend) / previousSpend : null,
    };
  }

  return {
    topCategory: categoryShares(agg, currency, categories)[0],
    vsLastMonth,
    noSpendDays: Math.max(0, elapsed - spentDays),
    elapsed,
  };
};
