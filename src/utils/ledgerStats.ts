import dayjs from "@/utils/configuredDayjs";
import { Currency } from "@/types/user";
import { CurrencyAmounts, LedgerCategory, LedgerEntry, LedgerMonth } from "@/types/ledger";
import { CURRENCIES } from "@/utils/currency";
import { formatMonth, resolveCategory, shiftMonth } from "@/utils/ledger";
import { formatDate } from "@/utils/dateFormat";
// Single source of truth for monthly aggregation, shared with the Cloud Function.
import { aggregateMonth, MonthAggregate } from "../../functions/src/ledgerAggregate";
import {
  budgetLines,
  budgetPace,
  isFixedCategory,
  totalIn,
} from "../../functions/src/ledgerBudget";

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

/** How the "by category" rows are ordered on the stats pages. */
export type CategorySort = "order" | "amount" | "pace";

export type SortedCategoryRow = BudgetRow & {
  /**
   * Budgeted rows: spending against what the budget allows so far (1 is on pace). An
   * everyday budget is spread over the days, so it's judged against the share of the
   * period gone by; a fixed cost is paid in one go, so it's simply its share used.
   */
  pace?: number;
};

/**
 * The category rows in the chosen order (they arrive in Categories-panel order, which
 * breaks ties): "amount" puts the most spent first; "pace" puts the budgets furthest
 * ahead of the calendar first, then unbudgeted rows by amount.
 */
export const sortCategoryRows = (
  rows: ReadonlyArray<BudgetRow>,
  sort: CategorySort,
  {
    categories,
    elapsedShare,
  }: {
    categories: ReadonlyArray<LedgerCategory>;
    /** How much of the period has gone by (0–1); past periods are 1. */
    elapsedShare: number;
  },
): SortedCategoryRow[] => {
  const share = elapsedShare > 0 ? Math.min(elapsedShare, 1) : 1;
  const withPace: SortedCategoryRow[] = rows.map((row) => {
    if (row.budget === undefined || row.budget <= 0) return { ...row };
    const fixed = isFixedCategory(categories.find((c) => c.id === row.id) ?? { id: row.id });
    return { ...row, pace: row.amount / (row.budget * (fixed ? 1 : share)) };
  });
  if (sort === "amount") return withPace.sort((a, b) => b.amount - a.amount);
  if (sort === "pace") {
    return withPace.sort((a, b) => {
      if (a.pace !== undefined && b.pace !== undefined) return b.pace - a.pace;
      if (a.pace !== undefined) return -1;
      if (b.pace !== undefined) return 1;
      return b.amount - a.amount;
    });
  }
  return withPace;
};

/** How much of `month` has gone by as of `today`, 0–1 (1 for past months). */
export const monthElapsedShare = (month: string, today: string): number =>
  elapsedDays(month, today) / dayjs(`${month}-01`).daysInMonth();

export type BudgetSummary = {
  /** The monthly total, else the sum of category budgets, in this currency. */
  budget: number;
  /** All spending with a monthly total; spending in budgeted categories without one. */
  spent: number;
  /** Set when the budget is a monthly total rather than the categories' sum. */
  isTotal: boolean;
  /** Category budgets' sum (with a total, how much of it the categories claim). */
  allocated: number;
  remaining: number; // negative when over
  used: number; // spent / budget
  over: boolean;
  /** Days left including today (current month only). */
  daysLeft: number | null;
  /**
   * What's left per remaining day (current month, not yet over). Fixed costs are set
   * aside at their budget, so it's what's left for everyday spending.
   */
  perDayLeft: number | null;
  /**
   * End-of-month spend (current month only): fixed costs at their budget (or what was
   * spent, if more), everything else at the current daily pace.
   */
  projected: number | null;
  /**
   * Everyday (non-fixed) spending against its budget's share of the days elapsed: 1 is
   * on pace. Null when only fixed costs have budgets.
   */
  pace: number | null;
};

const r2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Overall budget position for one currency, or null when nothing is budgeted in it. A
 * monthly total, when set, is the budget (see budgetLines).
 */
export const budgetSummary = ({
  month,
  today,
  currency,
  agg,
  categories,
  totals,
}: {
  month: string;
  today: string;
  currency: Currency;
  agg: Pick<MonthAggregate, "byCategory">;
  categories: ReadonlyArray<LedgerCategory>;
  /** The log's monthly totals (Ledger.monthlyBudget), as they stood in `month`. */
  totals?: CurrencyAmounts;
}): BudgetSummary | null => {
  const { total: allocated, byCategory } = budgetsFor(categories, currency);
  const monthlyTotal = totalIn(totals, currency);
  const {
    lines,
    spentIn,
    budget: total,
  } = budgetLines({
    budgets: Object.entries(byCategory),
    total: monthlyTotal,
    byCategory: agg.byCategory,
    currency,
  });
  if (total <= 0) return null;

  const daysInMonth = dayjs(`${month}-01`).daysInMonth();
  const isCurrent = month === today.slice(0, 7);
  const elapsed = elapsedDays(month, today);
  const daysLeft = isCurrent ? daysInMonth - elapsed + 1 : null;

  const fixed = new Set(categories.filter(isFixedCategory).map((c) => c.id));
  const pace = budgetPace({
    budgets: lines,
    isFixed: (id) => fixed.has(id),
    spentIn,
    elapsed,
    days: daysInMonth,
  });
  const { spent } = pace;
  const remaining = r2(total - spent);
  // With everyday budgets, what's left of those (never more than is left overall, in
  // case a fixed cost ran over); with only fixed ones, what's left of the whole.
  const everydayLeft =
    pace.flexibleBudget > 0
      ? Math.min(remaining, r2(pace.flexibleBudget - pace.flexibleSpent))
      : remaining;

  return {
    budget: total,
    spent,
    isTotal: monthlyTotal !== null,
    allocated,
    remaining,
    used: spent / total,
    over: spent > total,
    daysLeft,
    perDayLeft:
      isCurrent && remaining > 0 && daysLeft ? r2(Math.max(0, everydayLeft) / daysLeft) : null,
    projected: isCurrent && elapsed > 0 ? pace.projected : null,
    pace: elapsed > 0 ? pace.pace : null,
  };
};

/** The biggest category that isn't a fixed cost (what the buddy calls "our favourite"). */
export const topFlexibleCategory = (
  agg: Pick<MonthAggregate, "byCategory">,
  currency: Currency,
  categories: ReadonlyArray<LedgerCategory>,
): Share | undefined =>
  categoryShares(agg, currency, categories).find(
    (s) => !isFixedCategory(categories.find((c) => c.id === s.id) ?? { id: s.id }),
  );
