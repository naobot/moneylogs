import { collection, doc, getDocs, limit, query, runTransaction, where } from "firebase/firestore";
import { db } from "@/config/firebase-config";
import { LedgerCategory } from "@/types/ledger";
import { applyCategoryOps, CategoryOp } from "@/utils/ledgerCategories";
import { useMutation } from "./useFirebase";

export const useLedgerCategoryQuery = () => {
  /**
   * Replay the edits onto the latest categories in a transaction, so concurrent edits by
   * other members of a shared log are preserved rather than overwritten.
   */
  const saveCategoryOpsFn = async ({
    ledgerId,
    ops,
  }: {
    ledgerId: string;
    ops: ReadonlyArray<CategoryOp>;
  }): Promise<LedgerCategory[]> => {
    const ledgerRef = doc(db, "ledgers", ledgerId);
    return runTransaction(db, async (tx) => {
      const snap = await tx.get(ledgerRef);
      if (!snap.exists()) throw new Error("Financial log not found");
      const latest = (snap.data().categories ?? []) as LedgerCategory[];
      const next = applyCategoryOps(latest, ops);
      tx.update(ledgerRef, { categories: next });
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
