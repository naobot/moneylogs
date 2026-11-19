import { useEffect } from "react";
import { collection, documentId, query, where } from "firebase/firestore";
import { db } from "@/config/firebase-config";
import { BudgetSnapshot } from "@/utils/budgetHistory";
import { reportError } from "@/utils/reportError";
import { useFirebaseCollection } from "./useFirebase";

/**
 * A ledger's budget snapshots from `from` ("YYYY-MM") on. A month's budgets come from the
 * earliest snapshot at or after it, so the range is open-ended. It's a plain range on the
 * document id (no orderBy/limit, see useNoSpendDays) and the collection gains at most one
 * doc a month.
 */
export const useBudgetSnapshots = ({ ledgerId, from }: { ledgerId?: string; from: string }) => {
  const result = useFirebaseCollection<BudgetSnapshot>({
    queryBuilder: () =>
      ledgerId
        ? query(
            collection(db, "ledgers", ledgerId, "budgetSnapshots"),
            where(documentId(), ">=", from),
          )
        : null,
    dataTransformer: (docs) =>
      docs.map((d) => {
        const data = d.data();
        return { month: d.id, budgets: data.budgets ?? {}, names: data.names ?? {} };
      }),
    dependencies: [ledgerId, from],
    enabled: !!ledgerId,
  });

  useEffect(() => {
    if (result.isError)
      reportError(result.error, { feature: "ledger", action: "load_budget_snapshots" });
  }, [result.isError, result.error]);

  return { snapshots: result.data, isLoading: result.isLoading, isError: result.isError };
};
