import {
  collection,
  doc,
  getDocs,
  limit,
  query,
  runTransaction,
  serverTimestamp,
  where,
} from "firebase/firestore";
import { db } from "@/config/firebase-config";
import { CurrencyAmounts, LedgerCategory } from "@/types/ledger";
import { applyCategoryOps, CategoryOp } from "@/utils/ledgerCategories";
import { budgetsChanged, snapshotOf, totalsChanged } from "@/utils/budgetHistory";
import { applyTotalOps, TotalOp } from "@/utils/monthlyBudget";
import { shiftMonth } from "@/utils/ledger";
import { useMutation } from "./useFirebase";

export const useLedgerCategoryQuery = () => {
  /**
   * Replay the edits onto the latest categories in a transaction, so concurrent edits by
   * other members of a shared log are preserved rather than overwritten.
   *
   * `totalOps` change the monthly total (Ledger.monthlyBudget) in the same write.
   *
   * The first budget change in a month (category budgets or the total) also keeps the
   * outgoing budgets as last month's snapshot (see utils/budgetHistory), so finished
   * months stay judged by the budgets they had. `month` is the editor's current month,
   * in their timezone.
   */
  const saveCategoryOpsFn = async ({
    ledgerId,
    ops,
    totalOps = [],
    month,
  }: {
    ledgerId: string;
    ops: ReadonlyArray<CategoryOp>;
    totalOps?: ReadonlyArray<TotalOp>;
    month: string;
  }): Promise<LedgerCategory[]> => {
    const ledgerRef = doc(db, "ledgers", ledgerId);
    const previous = shiftMonth(month, -1);
    const snapshotRef = doc(db, "ledgers", ledgerId, "budgetSnapshots", previous);
    return runTransaction(db, async (tx) => {
      const snap = await tx.get(ledgerRef);
      if (!snap.exists()) throw new Error("Financial log not found");
      const latest = (snap.data().categories ?? []) as LedgerCategory[];
      const latestTotals = snap.data().monthlyBudget as CurrencyAmounts | undefined;
      const next = applyCategoryOps(latest, ops);
      const nextTotals = applyTotalOps(latestTotals, totalOps);
      const changedTotals = totalsChanged(latestTotals, nextTotals);
      // Reads go before writes in a transaction.
      if (
        (budgetsChanged(latest, next) || changedTotals) &&
        !(await tx.get(snapshotRef)).exists()
      ) {
        const { budgets, names, monthlyBudget } = snapshotOf(previous, latest, latestTotals);
        tx.set(snapshotRef, { budgets, names, monthlyBudget, snapshotAt: serverTimestamp() });
      }
      tx.update(ledgerRef, {
        categories: next,
        ...(changedTotals ? { monthlyBudget: nextTotals } : {}),
      });
      return next;
    });
  };

  /** Whether any entry uses the category (one-document read; automatic index). */
  const isCategoryUsedFn = async ({
    ledgerId,
    categoryId,
  }: {
    ledgerId: string;
    categoryId: string;
  }): Promise<boolean> => {
    const snap = await getDocs(
      query(
        collection(db, "ledgers", ledgerId, "entries"),
        where("categoryId", "==", categoryId),
        limit(1),
      ),
    );
    return !snap.empty;
  };

  return {
    saveCategoryOps: useMutation(saveCategoryOpsFn),
    isCategoryUsed: useMutation(isCategoryUsedFn),
  };
};
