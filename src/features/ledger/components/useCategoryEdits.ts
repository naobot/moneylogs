import { useEffect, useMemo, useRef, useState } from "react";

import { useToastContext } from "@/hooks/useToastContext";
import { CurrencyAmounts, LedgerCategory } from "@/types/ledger";
import { Currency } from "@/types/user";
import { track } from "@/utils/analytics";
import {
  applyCategoryOps,
  BudgetDrafts,
  budgetDraftKey,
  budgetDraftOps,
  budgetFieldError,
  CategoryOp,
} from "@/utils/ledgerCategories";
import { reportError } from "@/utils/reportError";

/** A write shown straight away, kept on top of the server copy until it comes back. */
type PendingEdit = { key: number; ops: CategoryOp[]; saved: boolean };

/**
 * Save-as-you-go editing of a log's categories, shared by the Categories and Budgets
 * windows: no Save or Cancel. Each write (one op, or a batch that must land together)
 * is sent one at a time, in order, and replayed onto the latest server copy (see
 * useLedgerCategoryQuery), so other members' concurrent edits survive. Until the server
 * copy catches up, `draft` shows the edits on top of it.
 *
 * Budget fields are typed into `budgetDrafts` and saved when a field is left.
 */
export const useCategoryEdits = (
  categories: ReadonlyArray<LedgerCategory>,
  onSave: (ops: CategoryOp[]) => Promise<unknown>,
) => {
  const [pending, setPending] = useState<PendingEdit[]>([]);
  const [budgetDrafts, setBudgetDrafts] = useState<BudgetDrafts>({});
  const [saveFailed, setSaveFailed] = useState(false);
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  const nextKey = useRef(0);
  const { showToast } = useToastContext();
  // Saves can finish after the window closes; a failure then is reported by toast.
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  // Replaying an edit the server copy already has changes nothing (ops are idempotent),
  // so saved edits only need dropping once the server copy has moved on.
  useEffect(() => {
    setPending((edits) => edits.filter((edit) => !edit.saved));
  }, [categories]);

  const draft = useMemo(
    () =>
      applyCategoryOps(
        categories,
        pending.flatMap((edit) => edit.ops),
      ),
    [categories, pending],
  );

  /** Budgets including fields still being typed, for each row's summary. */
  const budgetsShown: ReadonlyMap<string, CurrencyAmounts | undefined> = new Map(
    applyCategoryOps(draft, budgetDraftOps(draft, budgetDrafts)).map((c) => [c.id, c.budget]),
  );

  const save = (opOrOps: CategoryOp | CategoryOp[]) => {
    const ops = Array.isArray(opOrOps) ? opOrOps : [opOrOps];
    if (ops.length === 0) return;
    const key = nextKey.current++;
    setSaveFailed(false);
    setPending((edits) => [...edits, { key, ops, saved: false }]);
    queue.current = queue.current.then(async () => {
      try {
        await onSave(ops);
        setPending((edits) => edits.map((e) => (e.key === key ? { ...e, saved: true } : e)));
      } catch (err) {
        reportError(err, {
          feature: "ledger",
          action: "save_categories",
          extra: { op: ops[0].type, opCount: ops.length },
        });
        setPending((edits) => edits.filter((e) => e.key !== key));
        if (mounted.current) setSaveFailed(true);
        else showToast("Couldn't save your last category change. Please try again.");
      }
    });
  };

  const setBudgetDraft = (categoryId: string, currency: Currency, raw: string) => {
    setSaveFailed(false);
    setBudgetDrafts((d) => ({ ...d, [budgetDraftKey(categoryId, currency)]: raw }));
  };

  /** Saves the valid, changed budget fields (all of them, or one category's). */
  const commitBudgets = (categoryId?: string) => {
    budgetDraftOps(draft, budgetDrafts)
      .filter((op) => !categoryId || op.id === categoryId)
      .forEach((op) => save(op));
    // Invalid fields keep their text (and error) so nothing typed silently vanishes.
    setBudgetDrafts((drafts) =>
      Object.fromEntries(
        Object.entries(drafts).filter(
          ([key, raw]) =>
            (categoryId && !key.startsWith(`${categoryId}:`)) || !!budgetFieldError(raw),
        ),
      ),
    );
  };

  /** Removes one budget straight away, dropping anything typed into its field. */
  const removeBudget = (categoryId: string, currency: Currency) => {
    const key = budgetDraftKey(categoryId, currency);
    setBudgetDrafts(({ [key]: _dropped, ...rest }) => rest);
    save({ type: "setBudget", id: categoryId, currency, amount: null });
    track("remove_budget");
  };

  /** A category whose add is still saving (so it can't have entries yet). */
  const isUnsavedAdd = (categoryId: string) =>
    pending.some((e) => !e.saved && e.ops.some((op) => op.type === "add" && op.id === categoryId));

  return {
    draft,
    save,
    isSaving: pending.some((edit) => !edit.saved),
    saveFailed,
    budgetDrafts,
    budgetsShown,
    setBudgetDraft,
    commitBudgets,
    removeBudget,
    isUnsavedAdd,
  };
};

export type CategoryEdits = ReturnType<typeof useCategoryEdits>;
