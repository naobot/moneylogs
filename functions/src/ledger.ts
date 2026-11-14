import { onDocumentWritten } from "firebase-functions/v2/firestore";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import {
  affectedMonths,
  aggregateFieldsChanged,
  aggregateMonth,
  AggregatableEntry,
} from "./ledgerAggregate";
import { isCurrentMonth } from "./ledgerBudget";
import { notifyLedgerBudgets } from "./ledgerBudgetNotify";

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
 */
export const recomputeLedgerMonth = onDocumentWritten(
  "ledgers/{ledgerId}/entries/{entryId}",
  async (event) => {
    const { ledgerId } = event.params;
    const before = event.data?.before?.data() as
      | (Partial<AggregatableEntry> & { month?: string })
      | undefined;
    const after = event.data?.after?.data() as
      | (Partial<AggregatableEntry> & { month?: string })
      | undefined;

    if (!aggregateFieldsChanged(before, after)) return;

    const db = getFirestore();
    const ledgerRef = db.collection("ledgers").doc(ledgerId);

    // The ledger is being (or has been) deleted by deleteLog: don't rebuild summaries,
    // which would otherwise leave ghost months/ docs under a deleted ledger.
    const ledgerSnap = await ledgerRef.get();
    if (!ledgerSnap.exists || ledgerSnap.get("deleting") === true) return;

    for (const month of affectedMonths(before, after)) {
      const monthRef = ledgerRef.collection("months").doc(month);
      const entriesQuery = ledgerRef.collection("entries").where("month", "==", month);

      const aggregate = await db.runTransaction(async (tx) => {
        const snap = await tx.get(entriesQuery);
        const result = aggregateMonth(snap.docs.map((d) => d.data()));
        if (result.entryCount === 0) {
          tx.delete(monthRef);
        } else {
          tx.set(monthRef, { month, ...result, computedAt: FieldValue.serverTimestamp() });
        }
        return result;
      });

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
  },
);
