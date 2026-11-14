/**
 * Budget alerts for financial logs: pure helpers for recomputeLedgerMonth. Budgets are
 * monthly, per category and per currency, and never converted (see budgetsFor and
 * budgetSummary in src/utils/ledgerStats.ts, which this mirrors).
 *
 * Alerts fire for the month's total in each currency, and for each budgeted category.
 * Category alerts are opt-in per user (budget_category). Each has a fixed id per month,
 * so it goes out at most once:
 * - approaching: 80% of a budget spent;
 * - exceeded: over it (sent instead of "approaching" when one entry jumps past both);
 * - projected: the total only, on pace to finish the month over budget. At most twice
 *   a month (from day 7, then again from day 16), so early-month noise doesn't count.
 *
 * Dependency-free so it can be unit tested from the root Vitest run.
 */

export const APPROACHING_AT = 0.8;
export const PROJECTION_FROM_DAY = 7;
export const SECOND_PROJECTION_FROM_DAY = 16;

const HOUR_MS = 3_600_000;

export type BudgetCategory = {
  id: string;
  name?: string;
  archived?: boolean;
  budget?: { [currency: string]: number | undefined };
};

export type BudgetAlertType = "budget_approaching" | "budget_exceeded" | "budget_projected";

export type BudgetAlert = {
  id: string;
  /** Per-category alerts also need the recipient's budget_category preference. */
  categoryScoped: boolean;
  data: {
    type: BudgetAlertType;
    groupId: string;
    groupName: string;
    logKind: "ledger";
    month: string;
    currency: string;
    spent: number;
    budget: number;
    projected?: number;
    categoryId?: string;
    categoryName?: string;
  };
};

const r2 = (n: number) => Math.round(n * 100) / 100;

const utcMonth = (ms: number) => new Date(ms).toISOString().slice(0, 7);

/**
 * Whether `month` is the current month somewhere on Earth: entries are dated in their
 * author's own zone, which can run from UTC-12 to UTC+14.
 */
export const isCurrentMonth = (month: string, now: number): boolean =>
  month === utcMonth(now - 12 * HOUR_MS) || month === utcMonth(now + 14 * HOUR_MS);

const daysIn = (month: string) => {
  const [y, m] = month.split("-").map(Number);
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
};

/** Days of `month` elapsed at `now`, including today (UTC), clamped to the month. */
export const elapsedDays = (month: string, now: number): number => {
  const today = utcMonth(now);
  if (month < today) return daysIn(month);
  if (month > today) return 1;
  return new Date(now).getUTCDate();
};

/** Budgets in each currency for active categories. */
const budgetsByCurrency = (categories: ReadonlyArray<BudgetCategory>) => {
  const out = new Map<string, Map<string, number>>();
  for (const c of categories) {
    if (c.archived || !c.budget) continue;
    for (const [currency, amount] of Object.entries(c.budget)) {
      if (!amount || amount <= 0) continue;
      if (!out.has(currency)) out.set(currency, new Map());
      out.get(currency)!.set(c.id, amount);
    }
  }
  return out;
};

const alertId = (type: BudgetAlertType, ledgerId: string, month: string, ...rest: string[]) =>
  [type, ledgerId, month, ...rest].join("_");

export const budgetAlerts = ({
  ledgerId,
  ledgerName,
  month,
  categories,
  byCategory,
  now,
}: {
  ledgerId: string;
  ledgerName: string;
  month: string;
  categories: ReadonlyArray<BudgetCategory>;
  /** From the month aggregate: spending per category, per currency. */
  byCategory: { [categoryId: string]: { [currency: string]: number } };
  now: number;
}): BudgetAlert[] => {
  if (!isCurrentMonth(month, now)) return [];

  const alerts: BudgetAlert[] = [];
  const base = { groupId: ledgerId, groupName: ledgerName, logKind: "ledger" as const, month };
  const elapsed = elapsedDays(month, now);
  const days = daysIn(month);

  const threshold = (
    spent: number,
    budget: number,
    currency: string,
    category?: BudgetCategory,
  ) => {
    const type: BudgetAlertType | null =
      spent > budget
        ? "budget_exceeded"
        : spent >= budget * APPROACHING_AT
          ? "budget_approaching"
          : null;
    if (!type) return;
    alerts.push({
      id: alertId(type, ledgerId, month, currency, ...(category ? [category.id] : [])),
      categoryScoped: !!category,
      data: {
        type,
        ...base,
        currency,
        spent: r2(spent),
        budget: r2(budget),
        ...(category ? { categoryId: category.id, categoryName: category.name ?? "" } : {}),
      },
    });
  };

  for (const [currency, budgets] of budgetsByCurrency(categories)) {
    let total = 0;
    let spent = 0;
    for (const [categoryId, budget] of budgets) {
      const inCategory = byCategory[categoryId]?.[currency] ?? 0;
      total += budget;
      spent += inCategory;
      threshold(
        inCategory,
        budget,
        currency,
        categories.find((c) => c.id === categoryId),
      );
    }
    total = r2(total);
    spent = r2(spent);
    threshold(spent, total, currency);

    // Pace: only while still under budget, and not in the first few days.
    if (spent <= total && elapsed >= PROJECTION_FROM_DAY) {
      const projected = r2((spent / elapsed) * days);
      if (projected > total) {
        const slot = elapsed >= SECOND_PROJECTION_FROM_DAY ? "2" : "1";
        alerts.push({
          id: alertId("budget_projected", ledgerId, month, currency, slot),
          categoryScoped: false,
          data: { type: "budget_projected", ...base, currency, spent, budget: total, projected },
        });
      }
    }
  }
  return alerts;
};

/**
 * How spending in budgeted categories compares with the budget's share for the days
 * elapsed so far: 1 is right on pace, under 1 is under it. The worst budgeted currency
 * counts. Null when nothing has a budget. Feeds the knick-knack find chance, so it's
 * never shown.
 */
export const budgetPaceRatio = ({
  categories,
  byCategory,
  month,
  now,
}: {
  categories: ReadonlyArray<BudgetCategory>;
  byCategory: { [categoryId: string]: { [currency: string]: number } };
  month: string;
  now: number;
}): number | null => {
  const budgets = budgetsByCurrency(categories);
  if (!budgets.size) return null;
  const share = elapsedDays(month, now) / daysIn(month);
  let worst = 0;
  for (const [currency, byId] of budgets) {
    let total = 0;
    let spent = 0;
    for (const [categoryId, budget] of byId) {
      total += budget;
      spent += byCategory[categoryId]?.[currency] ?? 0;
    }
    worst = Math.max(worst, r2(spent) / (total * share));
  }
  return worst;
};

/** Months back that count as spending history, when a log has no budgets. */
export const HISTORY_MONTHS = 3;
/** Months with spending, out of those, needed before history stands in for a budget. */
export const MIN_HISTORY_MONTHS = 2;

/**
 * For logs without budgets: this month's spending so far against an average month
 * from the last few, scaled to the days elapsed. 1 is spending like usual, under 1 is
 * lighter than usual. The worst currency with history counts; currencies with no
 * history are left out. Null until there are enough months to go on.
 */
export const historyPaceRatio = ({
  totals,
  history,
  month,
  now,
}: {
  /** This month's totals per currency. */
  totals: { [currency: string]: number };
  /** Totals for previous months; missing or empty months count as no data. */
  history: ReadonlyArray<{ [currency: string]: number } | undefined>;
  month: string;
  now: number;
}): number | null => {
  const months = history.filter(
    (t): t is { [currency: string]: number } => !!t && Object.values(t).some((v) => v > 0),
  );
  if (months.length < MIN_HISTORY_MONTHS) return null;
  const share = elapsedDays(month, now) / daysIn(month);

  let worst: number | null = null;
  const currencies = new Set(months.flatMap((t) => Object.keys(t)));
  for (const currency of currencies) {
    const usual = months.reduce((sum, t) => sum + (t[currency] ?? 0), 0) / months.length;
    if (usual <= 0) continue;
    const ratio = r2(totals[currency] ?? 0) / (usual * share);
    worst = Math.max(worst ?? 0, ratio);
  }
  return worst;
};
