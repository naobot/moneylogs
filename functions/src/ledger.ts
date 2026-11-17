import { onDocumentWritten } from "firebase-functions/v2/firestore";
import { getFirestore, FieldValue, DocumentReference, Firestore } from "firebase-admin/firestore";
import {
  affectedMonths,
  aggregateFieldsChanged,
  aggregateMonth,
  AggregatableEntry,
  MonthAggregate,
} from "./ledgerAggregate";
import { isImportCreate } from "./ledgerImportPlan";
import { BudgetCategory, isCurrentMonth } from "./ledgerBudget";
import { notifyLedgerBudgets } from "./ledgerBudgetNotify";
import { maybeFindKnickKnack } from "./knickknackFind";
import { recordCheckIn } from "./checkIn";

/**
 * Rebuild one months/{YYYY-MM} summary from its entries, in a transaction. Deletes the
 * summary when the month has no entries left. Shared with importLedgerEntries.
 */
export const recomputeMonth = (
  db: Firestore,
  ledgerRef: DocumentReference,
  month: string,
): Promise<MonthAggregate> => {
  const monthRef = ledgerRef.collection("months").doc(month);
  const entriesQuery = ledgerRef.collection("entries").where("month", "==", month);
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(entriesQuery);
    const result = aggregateMonth(snap.docs.map((d) => d.data()));
    if (result.entryCount === 0) {
      tx.delete(monthRef);
    } else {
      tx.set(monthRef, { month, ...result, computedAt: FieldValue.serverTimestamp() });
    }
    return result;
  });
};

/**
 * Keep ledgers/{ledgerId}/months/{YYYY-MM} in sync with its entries.
 *
 * Each affected month is fully recomputed from its entries inside a transaction rather than
 * adjusted with increments: that makes the trigger idempotent (Firestore triggers are
 * at-least-once, so duplicate or retried events can't double-count) and self-healing.
 * Entries remain the single source of truth; month docs are a derived cache.
 *
 * For the current month it then sends any budget alerts that are newly due
 * (ledgerBudget.ts).
 *
 * A newly logged entry also counts as its author's check-in for the day, which can earn
 * a coin (checkIn.ts), and gives them the buddy's roll of the day for a knick-knack
 * (knickknackFind.ts).
 *
 * Entries created by a bulk import (importLedgerEntries) are skipped: that callable
 * recomputes each month once for the batch, and imports earn no rewards or alerts.
 */
export const recomputeLedgerMonth = onDocumentWritten(
  "ledgers/{ledgerId}/entries/{entryId}",
  async (event) => {
    const { ledgerId } = event.params;
    const before = event.data?.before?.data() as
      | (Partial<AggregatableEntry> & { month?: string })
      | undefined;
    const after = event.data?.after?.data() as
      | (Partial<AggregatableEntry> & { month?: string; importBatchId?: string })
      | undefined;

    if (isImportCreate(before, after)) return;
    if (!aggregateFieldsChanged(before, after)) return;

    const db = getFirestore();
    const ledgerRef = db.collection("ledgers").doc(ledgerId);

    // The ledger is being (or has been) deleted by deleteLog: don't rebuild summaries,
    // which would otherwise leave ghost months/ docs under a deleted ledger.
    const ledgerSnap = await ledgerRef.get();
    if (!ledgerSnap.exists || ledgerSnap.get("deleting") === true) return;

    for (const month of affectedMonths(before, after)) {
      const aggregate = await recomputeMonth(db, ledgerRef, month);

      if (!isCurrentMonth(month, Date.now())) continue;
      // Separately, so a failure here never holds up the summary above.
      try {
        await notifyLedgerBudgets({
          db,
          ledgerRef,
          ledger: ledgerSnap.data() ?? {},
          month,
          byCategory: aggregate.byCategory,
        });
      } catch (error) {
        console.error(`recomputeLedgerMonth: budget alerts for ${ledgerId}/${month}:`, error);
      }
    }

    // New entries only: editing or deleting one never earns a roll.
    const authorRef = (after as { author?: DocumentReference } | undefined)?.author;
    if (!before && authorRef && typeof authorRef.id === "string") {
      try {
        await recordCheckIn({
          db,
          ledgerRef,
          userRef: db.collection("users").doc(authorRef.id),
          loggedEntry: true,
        });
      } catch (error) {
        console.error(`recomputeLedgerMonth: check-in for ${ledgerId}:`, error);
      }
      try {
        await maybeFindKnickKnack({
          db,
          ledgerRef,
          authorRef,
          categories: (ledgerSnap.get("categories") ?? []) as BudgetCategory[],
        });
      } catch (error) {
        console.error(`recomputeLedgerMonth: knick-knack roll for ${ledgerId}:`, error);
      }
    }
  },
);
