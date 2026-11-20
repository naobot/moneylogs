import dayjs from "@/utils/configuredDayjs";
import { Currency } from "@/types/user";
import { CurrencyAmounts, LedgerCategory, LedgerMonth } from "@/types/ledger";
import { CURRENCIES } from "@/utils/currency";
import { BudgetSnapshot, categoriesForMonth, totalsForMonth } from "@/utils/budgetHistory";
import { budgetsFor, elapsedDays } from "@/utils/ledgerStats";

/**
 * Quarter and year stats, summed on the client from the derived month docs
 * (ledgers/{id}/months). Each month is judged by the budgets it had (budgetHistory).
 */

type MonthDocs = Readonly<Record<string, Pick<LedgerMonth, "totals" | "byCategory"> | undefined>>;

export type PeriodAggregate = {
  totals: CurrencyAmounts;
  byCategory: Record<string, CurrencyAmounts>;
};

const r2 = (n: number) => Math.round(n * 100) / 100;

const addInto = (target: CurrencyAmounts, amounts: CurrencyAmounts | undefined) => {
  for (const [c, n] of Object.entries(amounts ?? {}) as Array<[Currency, number | undefined]>) {
    if (n) target[c] = r2((target[c] ?? 0) + n);
  }
};

/** Totals and per-category spending over a set of months. */
export const aggregatePeriod = (
  months: ReadonlyArray<string>,
  byMonth: MonthDocs,
): PeriodAggregate => {
  const totals: CurrencyAmounts = {};
  const byCategory: Record<string, CurrencyAmounts> = {};
  for (const m of months) {
    const doc = byMonth[m];
    if (!doc) continue;
    addInto(totals, doc.totals);
    for (const [id, amounts] of Object.entries(doc.byCategory ?? {})) {
      addInto((byCategory[id] ??= {}), amounts);
    }
  }
  return { totals, byCategory };
};

/**
 * Currencies spent in over the period, those used in the most months first (ties in the
 * usual currency order). Amounts in different currencies aren't comparable, so the month
 * count stands in for "most used".
 */
export const periodCurrencies = (months: ReadonlyArray<string>, byMonth: MonthDocs): Currency[] => {
  const counts = new Map<Currency, number>();
  for (const m of months) {
    for (const [c, n] of Object.entries(byMonth[m]?.totals ?? {}) as Array<[Currency, number]>) {
      if (n > 0) counts.set(c, (counts.get(c) ?? 0) + 1);
    }
  }
  return CURRENCIES.filter((c) => counts.has(c)).sort(
    (a, b) => (counts.get(b) ?? 0) - (counts.get(a) ?? 0),
  );
};

/** The period's months that have begun as of the current month. */
export const monthsSoFar = (months: ReadonlyArray<string>, currentMonth: string): string[] =>
  months.filter((m) => m <= currentMonth);

/**
 * How much of the period's begun months has gone by, 0–1 (1 once it's over): what a
 * summed budget should be used up to by now, if spent evenly.
 */
export const periodElapsedShare = (months: ReadonlyArray<string>, today: string): number => {
  const begun = monthsSoFar(months, today.slice(0, 7));
  const days = begun.reduce((sum, m) => sum + dayjs(`${m}-01`).daysInMonth(), 0);
  const gone = begun.reduce((sum, m) => sum + elapsedDays(m, today), 0);
  return days > 0 ? gone / days : 0;
};

export type MonthBudgetResult = { month: string; budget: number; spent: number; over: boolean };

export type PeriodBudget = {
  /** Sum of each begun month's budget in this currency. */
  budget: number;
  /** Spending each month measured against its budget (see budgetSummary). */
  spent: number;
  used: number;
  over: boolean;
  /** Per month, for the months that had a budget in this currency. */
  months: MonthBudgetResult[];
  /** Finished months that stayed within their budget, and how many finished months had one. */
  within: number;
  finished: number;
  /**
   * Categories as budgeted over the period: each one's budget is the sum of its monthly
   * budgets, so the usual budget rows (categoryBudgetRows) work on the period aggregate.
   */
  categories: LedgerCategory[];
};

/**
 * Budget position over a period for one currency, or null when none of its begun months
 * had a budget in that currency. Months still to come aren't counted, so a quarter under
 * way compares spending so far with the budgets of the months so far.
 */
export const periodBudget = ({
  months,
  currentMonth,
  byMonth,
  categories,
  totals,
  snapshots,
  currency,
}: {
  months: ReadonlyArray<string>;
  currentMonth: string;
  byMonth: MonthDocs;
  categories: ReadonlyArray<LedgerCategory>;
  /** The standing monthly totals (Ledger.monthlyBudget). */
  totals?: CurrencyAmounts;
  snapshots: ReadonlyArray<BudgetSnapshot>;
  currency: Currency;
}): PeriodBudget | null => {
  const results: MonthBudgetResult[] = [];
  const summed = new Map<string, { budget: number; category: LedgerCategory }>();

  for (const month of monthsSoFar(months, currentMonth)) {
    const cats = categoriesForMonth(month, categories, snapshots);
    const { total: allocated, byCategory } = budgetsFor(cats, currency);
    // A monthly total, when that month had one, is its budget and counts all spending.
    const monthTotal = totalsForMonth(month, totals, snapshots)[currency] ?? 0;
    const total = monthTotal > 0 ? monthTotal : allocated;
    if (total <= 0) continue;
    let spent = monthTotal > 0 ? (byMonth[month]?.totals?.[currency] ?? 0) : 0;
    for (const [id, amount] of Object.entries(byCategory)) {
      if (monthTotal <= 0) spent += byMonth[month]?.byCategory?.[id]?.[currency] ?? 0;
      const prev = summed.get(id);
      const category = cats.find((c) => c.id === id)!;
      summed.set(id, {
        budget: (prev?.budget ?? 0) + amount,
        category: prev?.category ?? category,
      });
    }
    spent = r2(spent);
    results.push({ month, budget: total, spent, over: spent > total });
  }
  if (results.length === 0) return null;

  const budget = r2(results.reduce((s, r) => s + r.budget, 0));
  const spent = r2(results.reduce((s, r) => s + r.spent, 0));
  const finishedResults = results.filter((r) => r.month < currentMonth);

  const periodCats: LedgerCategory[] = categories.map((c) => {
    const { budget: _standing, ...rest } = c;
    const s = summed.get(c.id);
    return s ? { ...rest, archived: false, budget: { [currency]: r2(s.budget) } } : rest;
  });
  for (const [id, s] of summed) {
    if (!categories.some((c) => c.id === id)) {
      periodCats.push({ ...s.category, budget: { [currency]: r2(s.budget) } });
    }
  }

  return {
    budget,
    spent,
    used: budget > 0 ? spent / budget : 0,
    over: spent > budget,
    months: results,
    within: finishedResults.filter((r) => !r.over).length,
    finished: finishedResults.length,
    categories: periodCats,
  };
};

/**
 * Spending in one currency over the same stretch of the previous period: all of it when
 * this period is over, otherwise only as many months as this one has had so far.
 */
export const vsPreviousPeriod = ({
  months,
  previousMonths,
  currentMonth,
  byMonth,
  currency,
}: {
  months: ReadonlyArray<string>;
  previousMonths: ReadonlyArray<string>;
  currentMonth: string;
  byMonth: MonthDocs;
  currency: Currency;
}): { current: number; previous: number; change: number | null } | null => {
  const sofar = monthsSoFar(months, currentMonth).length;
  if (sofar === 0) return null;
  const sum = (ms: ReadonlyArray<string>) =>
    r2(ms.reduce((s, m) => s + (byMonth[m]?.totals?.[currency] ?? 0), 0));
  const previous = sum(previousMonths.slice(0, sofar));
  if (previous <= 0) return null;
  const current = sum(months.slice(0, sofar));
  return { current, previous, change: (current - previous) / previous };
};

/** The month with the most spending in a currency, if any. */
export const busiestMonth = (
  months: ReadonlyArray<string>,
  byMonth: MonthDocs,
  currency: Currency,
): { month: string; amount: number } | null => {
  let best: { month: string; amount: number } | null = null;
  for (const m of months) {
    const amount = byMonth[m]?.totals?.[currency] ?? 0;
    if (amount > 0 && (!best || amount > best.amount)) best = { month: m, amount };
  }
  return best;
};
