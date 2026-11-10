import dayjs from "@/utils/configuredDayjs";
import { Currency } from "@/types/user";
import { CurrencyAmounts, LedgerCategory, LedgerEntry, LedgerMonth } from "@/types/ledger";
import { CURRENCIES } from "@/utils/currency";
import { formatMonth, resolveCategory, shiftMonth } from "@/utils/ledger";
import { formatDate } from "@/utils/dateFormat";
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

/**
 * Rows in the order set in the Categories panel (stable; unknown ids last). Shares are
 * computed largest-first, so use this for display only — not when the biggest matters.
 */
export const inCategoryOrder = <T extends { id: string }>(
  rows: ReadonlyArray<T>,
  categories: ReadonlyArray<LedgerCategory>,
): T[] =>
  [...rows].sort((a, b) => {
    const diff = resolveCategory(a.id, categories).order - resolveCategory(b.id, categories).order;
    return diff || 0; // Infinity - Infinity is NaN: two unknown ids keep their order
  });

/** How many top categories the stacked category bar draws individually. */
export const BAR_SEGMENTS = 4;

/** A category's fill in the stacked bar: its index among the drawn ones, or "rest". */
export type BarSegment = number | "rest";

/**
 * The stacked category bar: the largest `BAR_SEGMENTS` categories, shown in
 * Categories-panel order, then everything else grouped as "rest". `segmentOf` gives
 * each category id its fill, so other views (the share rows) can show the same key.
 */
export const categoryBarSegments = (
  shares: ReadonlyArray<Share>,
  categories: ReadonlyArray<LedgerCategory>,
) => {
  const top = inCategoryOrder(shares.slice(0, BAR_SEGMENTS), categories);
  const restShares = shares.slice(BAR_SEGMENTS);
  const rest = restShares.reduce((sum, s) => sum + s.share, 0);
  const segmentOf = new Map<string, BarSegment>();
  top.forEach((s, i) => segmentOf.set(s.id, i));
  restShares.forEach((s) => segmentOf.set(s.id, "rest"));
  return { top, rest, segmentOf };
};

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
    return {
      key: `${month}-${dd}`,
      date,
      label: formatDate(date, { year: false }),
      amount,
      cumulative,
    };
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

// ---------------------------------------------------------------------------
// Budgets: standing monthly amounts per category and currency (never converted).
// ---------------------------------------------------------------------------

/** Budgets in one currency for active categories. */
export const budgetsFor = (
  categories: ReadonlyArray<LedgerCategory>,
  currency: Currency,
): { total: number; byCategory: Record<string, number> } => {
  const byCategory: Record<string, number> = {};
  for (const c of categories) {
    const amount = c.budget?.[currency];
    if (!c.archived && amount && amount > 0) byCategory[c.id] = amount;
  }
  const total = Object.values(byCategory).reduce((sum, n) => sum + n, 0);
  return { total: Math.round(total * 100) / 100, byCategory };
};

export type BudgetRow = Share & { budget?: number; over: boolean };

/**
 * Category shares with budgets merged in. Budgeted categories with nothing spent yet are
 * included (at 0) so you can see what's left in them.
 */
export const categoryBudgetRows = (
  agg: Pick<MonthAggregate, "byCategory">,
  currency: Currency,
  categories: ReadonlyArray<LedgerCategory>,
): BudgetRow[] => {
  const { byCategory: budgets } = budgetsFor(categories, currency);
  const rows: BudgetRow[] = categoryShares(agg, currency, categories).map((s) => ({
    ...s,
    budget: budgets[s.id],
    over: budgets[s.id] !== undefined && s.amount > budgets[s.id],
  }));
  for (const [id, budget] of Object.entries(budgets)) {
    if (!rows.some((r) => r.id === id)) {
      rows.push({
        id,
        name: resolveCategory(id, categories).name,
        amount: 0,
        share: 0,
        budget,
        over: false,
      });
    }
  }
  return inCategoryOrder(rows, categories);
};

export type BudgetSummary = {
  budget: number; // sum of budgets in this currency
  spent: number; // spending in budgeted categories only
  remaining: number; // negative when over
  used: number; // spent / budget
  over: boolean;
  /** Days left including today (current month only). */
  daysLeft: number | null;
  /** What's left per remaining day (current month, not yet over). */
  perDayLeft: number | null;
  /** End-of-month spend at the current daily pace (current month only). */
  projected: number | null;
};

const r2 = (n: number) => Math.round(n * 100) / 100;

/** Overall budget position for one currency, or null when nothing is budgeted in it. */
export const budgetSummary = ({
  month,
  today,
  currency,
  agg,
  categories,
}: {
  month: string;
  today: string;
  currency: Currency;
  agg: Pick<MonthAggregate, "byCategory">;
  categories: ReadonlyArray<LedgerCategory>;
}): BudgetSummary | null => {
  const { total, byCategory } = budgetsFor(categories, currency);
  if (total <= 0) return null;

  const spent = r2(
    Object.keys(byCategory).reduce((sum, id) => sum + (agg.byCategory[id]?.[currency] ?? 0), 0),
  );
  const remaining = r2(total - spent);
  const daysInMonth = dayjs(`${month}-01`).daysInMonth();
  const isCurrent = month === today.slice(0, 7);
  const elapsed = elapsedDays(month, today);
  const daysLeft = isCurrent ? daysInMonth - elapsed + 1 : null;

  return {
    budget: total,
    spent,
    remaining,
    used: spent / total,
    over: spent > total,
    daysLeft,
    perDayLeft: isCurrent && remaining > 0 && daysLeft ? r2(remaining / daysLeft) : null,
    projected: isCurrent && elapsed > 0 ? r2((spent / elapsed) * daysInMonth) : null,
  };
};
