import { CurrencyAmounts, LedgerCategory } from "@/types/ledger";

/**
 * Budget history for a financial log.
 *
 * Budgets are standing monthly amounts on the ledger's categories. So that changing them
 * doesn't rewrite how finished months are judged, the first budget change in a month
 * stores the outgoing budgets as ledgers/{id}/budgetSnapshots/{previous month}: "these
 * were the budgets through this month". A month's budgets are then those of the earliest
 * snapshot at or after it, or the standing budgets when no later snapshot exists. The
 * log's monthly total (Ledger.monthlyBudget) is kept the same way.
 */
export type BudgetSnapshot = {
  /** "YYYY-MM": the last month these budgets applied to. */
  month: string;
  /** Active categories' budgets at the time, by category id. */
  budgets: Record<string, CurrencyAmounts>;
  /** Names at the time, so deleted categories still label their budget. */
  names: Record<string, string>;
  /** The monthly total at the time. Snapshots from before totals existed lack it. */
  monthlyBudget?: CurrencyAmounts;
};

const positive = (amounts: CurrencyAmounts | undefined): CurrencyAmounts => {
  const out: CurrencyAmounts = {};
  for (const [currency, amount] of Object.entries(amounts ?? {})) {
    if (amount && amount > 0) out[currency as keyof CurrencyAmounts] = amount;
  }
  return out;
};

/** A monthly total with only the currencies actually set. */
export const effectiveTotals = (totals: CurrencyAmounts | undefined): CurrencyAmounts =>
  positive(totals);

/** True when an edit changed the monthly total in some currency. */
export const totalsChanged = (
  before: CurrencyAmounts | undefined,
  after: CurrencyAmounts | undefined,
): boolean => !sameAmounts(positive(before), positive(after));

/** The budgets that count: active categories with a positive amount in some currency. */
export const effectiveBudgets = (
  categories: ReadonlyArray<LedgerCategory>,
): Record<string, CurrencyAmounts> => {
  const out: Record<string, CurrencyAmounts> = {};
  for (const c of categories) {
    if (c.archived) continue;
    const amounts = positive(c.budget);
    if (Object.keys(amounts).length > 0) out[c.id] = amounts;
  }
  return out;
};

const sameAmounts = (a: CurrencyAmounts, b: CurrencyAmounts) => {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]) as Set<keyof CurrencyAmounts>;
  for (const k of keys) if (a[k] !== b[k]) return false;
  return true;
};

/** True when an edit changed what's budgeted (amounts, or categories archived/removed). */
export const budgetsChanged = (
  before: ReadonlyArray<LedgerCategory>,
  after: ReadonlyArray<LedgerCategory>,
): boolean => {
  const a = effectiveBudgets(before);
  const b = effectiveBudgets(after);
  const ids = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const id of ids) {
    if (!a[id] || !b[id] || !sameAmounts(a[id], b[id])) return true;
  }
  return false;
};

/** The snapshot to store for the budgets in `categories` and the total (before an edit). */
export const snapshotOf = (
  month: string,
  categories: ReadonlyArray<LedgerCategory>,
  monthlyBudget?: CurrencyAmounts,
): Required<BudgetSnapshot> => {
  const budgets = effectiveBudgets(categories);
  const names: Record<string, string> = {};
  for (const c of categories) if (budgets[c.id]) names[c.id] = c.name;
  return { month, budgets, names, monthlyBudget: positive(monthlyBudget) };
};

/** The snapshot that covers a month: the earliest one at or after it. */
export const snapshotForMonth = (
  month: string,
  snapshots: ReadonlyArray<BudgetSnapshot>,
): BudgetSnapshot | undefined => {
  let found: BudgetSnapshot | undefined;
  for (const s of snapshots) {
    if (s.month >= month && (!found || s.month < found.month)) found = s;
  }
  return found;
};

/**
 * Categories as they were budgeted under a snapshot: each category's budget replaced by
 * the snapshot's, categories budgeted then counted as active, and budgeted categories
 * that have since been deleted added back under their old name. Without a snapshot the
 * categories are returned as they are.
 */
export const withSnapshotBudgets = (
  categories: ReadonlyArray<LedgerCategory>,
  snapshot: BudgetSnapshot | undefined,
): LedgerCategory[] => {
  if (!snapshot) return [...categories];
  const out: LedgerCategory[] = categories.map((c) => {
    const { budget: _standing, ...rest } = c;
    const budget = snapshot.budgets[c.id];
    return budget ? { ...rest, archived: false, budget } : rest;
  });
  let order = Math.max(0, ...categories.map((c) => c.order)) + 1;
  for (const [id, budget] of Object.entries(snapshot.budgets)) {
    if (categories.some((c) => c.id === id)) continue;
    out.push({ id, name: snapshot.names[id] ?? "Uncategorised", order: order++, budget });
  }
  return out;
};

/** Categories with the budgets that applied in `month`. */
export const categoriesForMonth = (
  month: string,
  categories: ReadonlyArray<LedgerCategory>,
  snapshots: ReadonlyArray<BudgetSnapshot>,
): LedgerCategory[] => withSnapshotBudgets(categories, snapshotForMonth(month, snapshots));

/** The monthly total that applied in `month` (see snapshotForMonth). */
export const totalsForMonth = (
  month: string,
  standing: CurrencyAmounts | undefined,
  snapshots: ReadonlyArray<BudgetSnapshot>,
): CurrencyAmounts => {
  const snapshot = snapshotForMonth(month, snapshots);
  return positive(snapshot ? snapshot.monthlyBudget : standing);
};
