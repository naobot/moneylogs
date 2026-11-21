import { DocumentData, DocumentReference, FieldValue, Firestore } from "firebase-admin/firestore";
import { aggregateMonth, MonthAggregate } from "./ledgerAggregate";
import { isCurrentMonth } from "./ledgerBudget";
import { notifyLedgerBudgets } from "./ledgerBudgetNotify";
import { mergeRollups, RollupDoc } from "./ledgerRollup";
import { reportError } from "./sentry";

/**
 * Rebuild one months/{YYYY-MM} summary from its entries, in a transaction. Deletes the
 * summary when the month has nothing left in it.
 *
 * `withRollups`: the ledger has (or had) sublogs, so the month also takes in its
 * rollups/ docs for that month (see ledgerRollup.ts). Only those ledgers pay for the
 * extra query.
 */
export const recomputeMonth = (
  db: Firestore,
  ledgerRef: DocumentReference,
  month: string,
  { withRollups = false }: { withRollups?: boolean } = {},
): Promise<MonthAggregate> => {
  const monthRef = ledgerRef.collection("months").doc(month);
  const entriesQuery = ledgerRef.collection("entries").where("month", "==", month);
  const rollupsQuery = ledgerRef.collection("rollups").where("month", "==", month);
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(entriesQuery);
    const own = aggregateMonth(snap.docs.map((d) => d.data()));
    const rollups = withRollups
      ? (await tx.get(rollupsQuery)).docs.map((d) => d.data() as Partial<RollupDoc>)
      : [];
    const result = rollups.length ? mergeRollups(own, rollups) : own;
    const rolledUp = "rolledUp" in result ? (result.rolledUp as Record<string, number>) : {};
    const empty = result.entryCount === 0 && Object.keys(rolledUp).length === 0;
    if (empty) {
      tx.delete(monthRef);
    } else {
      tx.set(monthRef, { month, ...result, computedAt: FieldValue.serverTimestamp() });
    }
    return result;
  });
};

/**
 * Send the month's newly due budget alerts, if it's the current month. Best-effort: a
 * failure is reported, never thrown, so it can't hold up the summary or an import.
 */
export const alertBudgetsIfCurrent = async ({
  db,
  ledgerRef,
  ledger,
  month,
  aggregate,
}: {
  db: Firestore;
  ledgerRef: DocumentReference;
  ledger: DocumentData;
  month: string;
  aggregate: MonthAggregate;
}): Promise<void> => {
  if (!isCurrentMonth(month, Date.now())) return;
  try {
    await notifyLedgerBudgets({ db, ledgerRef, ledger, month, byCategory: aggregate.byCategory });
  } catch (error) {
    reportError(error, { action: "budget_alerts", level: "warning", extra: { month } });
  }
};
