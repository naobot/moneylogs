import { onDocumentWritten } from "firebase-functions/v2/firestore";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import {
  affectedMonths,
  aggregateFieldsChanged,
  aggregateMonth,
  AggregatableEntry,
} from "./ledgerAggregate";

/**
 * Keep ledgers/{ledgerId}/months/{YYYY-MM} in sync with its entries.
 *
 * Each affected month is fully recomputed from its entries inside a transaction rather than
 * adjusted with increments: that makes the trigger idempotent (Firestore triggers are
 * at-least-once, so duplicate or retried events can't double-count) and self-healing.
 * Entries remain the single source of truth; month docs are a derived cache.
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

    for (const month of affectedMonths(before, after)) {
      const monthRef = ledgerRef.collection("months").doc(month);
      const entriesQuery = ledgerRef.collection("entries").where("month", "==", month);

      await db.runTransaction(async (tx) => {
        const snap = await tx.get(entriesQuery);
        const aggregate = aggregateMonth(snap.docs.map((d) => d.data()));
        if (aggregate.entryCount === 0) {
          tx.delete(monthRef);
        } else {
          tx.set(monthRef, { month, ...aggregate, computedAt: FieldValue.serverTimestamp() });
        }
      });
    }
  },
);
