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
 * A ledger with `hasRollups` (it has or had sublogs) also takes in its rollups/ docs for
 * that month (see ledgerRollup.ts); only those ledgers pay for the extra query. The flag
 * is read in the same transaction, so a summary written while a first sublog is being
 * linked can't leave out the roll-ups it just backfilled.
 */
export const recomputeMonth = (
  db: Firestore,
  ledgerRef: DocumentReference,
  month: string,
): Promise<MonthAggregate> => {
  const monthRef = ledgerRef.collection("months").doc(month);
  const entriesQuery = ledgerRef.collection("entries").where("month", "==", month);
  const rollupsQuery = ledgerRef.collection("rollups").where("month", "==", month);
  return db.runTransaction(async (tx) => {
    const [ledger, snap] = await Promise.all([tx.get(ledgerRef), tx.get(entriesQuery)]);
    const own = aggregateMonth(snap.docs.map((d) => d.data()));
    const rollups =
      ledger.get("hasRollups") === true
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
