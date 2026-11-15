import { LedgerCategory } from "@/types/ledger";
import { Currency } from "@/types/user";
import { CURRENCIES, isCurrency } from "@/utils/currency";
import { parseAmount } from "@/utils/ledgerEntries";
import { MAX_CATEGORY_NAME_LENGTH, normaliseCategoryName } from "@/utils/ledger";

/** Matches the `categories.size() <= 50` cap in firestore.rules. */
export const MAX_CATEGORIES = 50;

/**
 * Category edits are recorded as operations and replayed onto the latest server copy
 * inside a transaction, so two members editing a shared log's categories at the same
 * time don't overwrite each other.
 */
export type CategoryOp =
  | { type: "add"; id: string; name: string }
  | { type: "rename"; id: string; name: string }
  | { type: "move"; id: string; toIndex: number } // index within the active list
  | { type: "archive"; id: string }
  | { type: "unarchive"; id: string }
  | { type: "delete"; id: string }
  // Monthly budget for one currency; null removes it.
  | { type: "setBudget"; id: string; currency: Currency; amount: number | null };

/** Largest budget accepted (sanity bound against typos like an extra few zeros). */
export const MAX_BUDGET = 1_000_000_000;

export const isValidBudgetAmount = (amount: number): boolean =>
  Number.isFinite(amount) && amount > 0 && amount <= MAX_BUDGET;

/**
 * Budget fields being typed into, keyed by budgetDraftKey: the raw text of each field
 * the user has touched. Turned into setBudget ops only on Save, so there's no
 * per-field "set" step.
 */
export type BudgetDrafts = Record<string, string>;

export const budgetDraftKey = (categoryId: string, currency: Currency) =>
  `${categoryId}:${currency}`;

/** What a budget field shows: the draft if touched, else the saved amount (or empty). */
export const budgetFieldValue = (
  drafts: BudgetDrafts,
  category: LedgerCategory,
  currency: Currency,
): string =>
  drafts[budgetDraftKey(category.id, currency)] ?? String(category.budget?.[currency] ?? "");

/** A field's problem, if any: empty is fine (no budget), anything else must be valid. */
export const budgetFieldError = (raw: string): string | undefined =>
  raw.trim() === "" || isValidBudgetAmount(parseAmount(raw))
    ? undefined
    : `Enter an amount between 0 and ${MAX_BUDGET.toLocaleString("en-US")}.`;

/**
 * The setBudget ops that turn saved budgets into the drafts. Untouched or unchanged
 * fields produce nothing; a cleared field removes that budget. Invalid fields produce
 * nothing either (callers block Save while any field has an error).
 */
export const budgetDraftOps = (
  categories: ReadonlyArray<LedgerCategory>,
  drafts: BudgetDrafts,
): CategoryOp[] => {
  const ops: CategoryOp[] = [];
  for (const category of categories) {
    for (const currency of CURRENCIES) {
      const raw = drafts[budgetDraftKey(category.id, currency)];
      if (raw === undefined || budgetFieldError(raw)) continue;
      const saved = category.budget?.[currency];
      const amount = raw.trim() === "" ? null : Math.round(parseAmount(raw) * 100) / 100;
      if (amount === (saved ?? null)) continue;
      ops.push({ type: "setBudget", id: category.id, currency, amount });
    }
  }
  return ops;
};

/** The currency most active budgets are in, else the fallback (e.g. the log's default). */
export const preferredBudgetCurrency = (
  categories: ReadonlyArray<LedgerCategory>,
  fallback: Currency,
): Currency => {
  const counts = new Map<Currency, number>();
  for (const c of categories) {
    if (c.archived) continue;
    for (const currency of CURRENCIES) {
      if ((c.budget?.[currency] ?? 0) > 0) counts.set(currency, (counts.get(currency) ?? 0) + 1);
    }
  }
  let best = fallback;
  for (const [currency, n] of counts) {
    if (n > (counts.get(best) ?? 0)) best = currency;
  }
  return best;
};

/** True when any active category has a positive monthly budget, in any currency. */
export const hasAnyBudget = (categories: ReadonlyArray<LedgerCategory>): boolean =>
  categories.some(
    (c) => !c.archived && Object.values(c.budget ?? {}).some((amount) => (amount ?? 0) > 0),
  );

const sameName = (a: string, b: string) =>
  normaliseCategoryName(a).toLowerCase() === normaliseCategoryName(b).toLowerCase();

/** Validation message for a category name, or undefined when it's fine. */
export const categoryNameError = (
  name: string,
  categories: ReadonlyArray<LedgerCategory>,
  exceptId?: string,
): string | undefined => {
  const clean = normaliseCategoryName(name);
  if (!clean) return "Name can't be empty";
  if (clean.length > MAX_CATEGORY_NAME_LENGTH) {
    return `Name must be ${MAX_CATEGORY_NAME_LENGTH} characters or fewer`;
  }
  const clash = categories.find((c) => c.id !== exceptId && sameName(c.name, clean));
  if (clash) {
    return clash.archived
      ? `"${clash.name}" already exists (archived) — restore it instead`
      : `"${clash.name}" already exists`;
  }
  return undefined;
};

/** A stable, readable id derived from the name, unique among existing ids. */
export const newCategoryId = (name: string, categories: ReadonlyArray<LedgerCategory>): string => {
  const base =
    normaliseCategoryName(name)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "category";
  const taken = new Set(categories.map((c) => c.id));
  if (!taken.has(base)) return base;
  let n = 2;
  while (taken.has(`${base}-${n}`)) n++;
  return `${base}-${n}`;
};

/** Active categories in order, then archived ones, renumbered 0..n-1. */
export const normaliseOrder = (categories: ReadonlyArray<LedgerCategory>): LedgerCategory[] => {
  const byOrder = [...categories].sort((a, b) => a.order - b.order);
  return [...byOrder.filter((c) => !c.archived), ...byOrder.filter((c) => c.archived)].map(
    (c, order) => ({ ...c, order }),
  );
};

/**
 * Apply one operation. Operations that no longer make sense against the given list
 * (unknown id, a name that now clashes, the cap reached) are skipped rather than thrown,
 * so replaying onto a newer server copy degrades gracefully.
 */
export const applyCategoryOp = (
  categories: ReadonlyArray<LedgerCategory>,
  op: CategoryOp,
): LedgerCategory[] => {
  const list = normaliseOrder(categories);
  const index = list.findIndex((c) => c.id === op.id);

  switch (op.type) {
    case "add": {
      if (index !== -1 || list.length >= MAX_CATEGORIES) return list;
      if (categoryNameError(op.name, list)) return list;
      const activeCount = list.filter((c) => !c.archived).length;
      const added = { id: op.id, name: normaliseCategoryName(op.name), order: activeCount - 0.5 };
      return normaliseOrder([...list, added]);
    }
    case "rename": {
      if (index === -1 || categoryNameError(op.name, list, op.id)) return list;
      return list.map((c) => (c.id === op.id ? { ...c, name: normaliseCategoryName(op.name) } : c));
    }
    case "move": {
      if (index === -1 || list[index].archived) return list;
      const active = list.filter((c) => !c.archived);
      const from = active.findIndex((c) => c.id === op.id);
      const to = Math.max(0, Math.min(op.toIndex, active.length - 1));
      const [moved] = active.splice(from, 1);
      active.splice(to, 0, moved);
      return normaliseOrder(
        [...active, ...list.filter((c) => c.archived)].map((c, order) => ({ ...c, order })),
      );
    }
    case "archive":
    case "unarchive": {
      if (index === -1) return list;
      const archived = op.type === "archive";
      // Never archive the last active category: entries always need somewhere to go.
      if (archived && list.filter((c) => !c.archived).length <= 1 && !list[index].archived) {
        return list;
      }
      // Restored categories go to the end of the active list.
      const restoredOrder = list.length;
      return normaliseOrder(
        list.map((c) => {
          if (c.id !== op.id) return c;
          const { archived: _wasArchived, ...rest } = c;
          return archived ? { ...rest, archived: true } : { ...rest, order: restoredOrder };
        }),
      );
    }
    case "delete": {
      if (index === -1) return list;
      if (!list[index].archived && list.filter((c) => !c.archived).length <= 1) return list;
      return normaliseOrder(list.filter((c) => c.id !== op.id));
    }
    case "setBudget": {
      if (index === -1 || !isCurrency(op.currency)) return list;
      if (op.amount !== null && !isValidBudgetAmount(op.amount)) return list;
      return list.map((c) => {
        if (c.id !== op.id) return c;
        const budget = { ...c.budget };
        if (op.amount === null) delete budget[op.currency];
        else budget[op.currency] = Math.round(op.amount * 100) / 100;
        const { budget: _old, ...rest } = c;
        // Drop the field entirely when no budgets remain.
        return Object.keys(budget).length > 0 ? { ...rest, budget } : rest;
      });
    }
  }
};

export const applyCategoryOps = (
  categories: ReadonlyArray<LedgerCategory>,
  ops: ReadonlyArray<CategoryOp>,
): LedgerCategory[] => ops.reduce<LedgerCategory[]>(applyCategoryOp, normaliseOrder(categories));
