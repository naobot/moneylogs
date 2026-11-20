import { CurrencyAmounts, LedgerCategory } from "@/types/ledger";
import { Currency } from "@/types/user";
import { monthKeyOf } from "@/utils/ledger";
import { isValidBudgetAmount } from "@/utils/ledgerCategories";
import { budgetsFor } from "@/utils/ledgerStats";

/**
 * The month's total budget (Ledger.monthlyBudget): expected income, or a cap on spending,
 * per currency. Category budgets are carved out of it; whatever they don't claim covers
 * spending in categories without a budget.
 */

/** Sets (or, with null, removes) the total in one currency. */
export type TotalOp = { currency: Currency; amount: number | null };

export const applyTotalOps = (
  totals: CurrencyAmounts | undefined,
  ops: ReadonlyArray<TotalOp>,
): CurrencyAmounts => {
  const out: CurrencyAmounts = { ...totals };
  for (const { currency, amount } of ops) {
    if (amount === null) delete out[currency];
    else if (isValidBudgetAmount(amount)) out[currency] = Math.round(amount * 100) / 100;
  }
  return out;
};

/**
 * Whether the stats page for `month` may edit the total. There is one standing total, saved
 * against this month's snapshot, so only the current month edits it: a finished month keeps
 * its own snapshot, and a future month would really be changing this one.
 */
export const canEditTotal = (month: string, today: string): boolean => month === monthKeyOf(today);

export type Allocation = {
  /** What the category budgets add up to in this currency. */
  allocated: number;
  /** Left of the total for categories without a budget (0 when over-allocated). */
  unallocated: number;
  /** How far the category budgets go past the total (0 when they fit). */
  over: number;
};

/** How the category budgets in one currency sit within a total. */
export const allocationOf = (
  total: number,
  categories: ReadonlyArray<LedgerCategory>,
  currency: Currency,
): Allocation => {
  const { total: allocated } = budgetsFor(categories, currency);
  const left = Math.round((total - allocated) * 100) / 100;
  return { allocated, unallocated: Math.max(0, left), over: Math.max(0, -left) };
};
