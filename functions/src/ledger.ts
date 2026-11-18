import { onDocumentWritten } from "firebase-functions/v2/firestore";
import {
  getFirestore,
  FieldValue,
  DocumentData,
  DocumentReference,
  Firestore,
} from "firebase-admin/firestore";
import {
  affectedMonths,
  aggregateFieldsChanged,
  aggregateMonth,
  AggregatableEntry,
  MonthAggregate,
} from "./ledgerAggregate";
import { isImportCreate } from "./ledgerImportPlan";
import { isCurrentMonth } from "./ledgerBudget";
import { notifyLedgerBudgets } from "./ledgerBudgetNotify";
import { takeDailyChance } from "./knickknackFind";
import { recordCheckIn } from "./checkIn";
import { reportError, withSentry } from "./sentry";

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

/**
 * What logging spending earns its author: today's check-in (and the copper coin for a first
 * entry), then the day's entry roll for a knick-knack. Both count once per day, so
 * calling this once for a whole import earns the same as logging by hand. Best-effort:
 * failures are reported, never thrown.
 */
export const rewardLoggedEntry = async ({
  db,
  ledgerRef,
  authorRef,
}: {
  db: Firestore;
  ledgerRef: DocumentReference;
  authorRef: DocumentReference;
}): Promise<void> => {
  try {
    await recordCheckIn({
      db,
      ledgerRef,
      userRef: db.collection("users").doc(authorRef.id),
      loggedEntry: true,
    });
  } catch (error) {
    reportError(error, { action: "check_in", level: "warning" });
  }
  try {
    await takeDailyChance({
      db,
      userRef: db.collection("users").doc(authorRef.id),
      kind: "entry",
      ledgerId: ledgerRef.id,
    });
  } catch (error) {
    reportError(error, { action: "knickknack_roll", level: "warning" });
  }
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
 * Entries created by a bulk import (importLedgerEntries) are skipped: that callable does
 * the same work once for the whole batch (each month recomputed and alerted once, one
 * check-in and knick-knack roll).
 */
export const recomputeLedgerMonth = onDocumentWritten(
  "ledgers/{ledgerId}/entries/{entryId}",
  withSentry("recomputeLedgerMonth", async (event) => {
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
      await alertBudgetsIfCurrent({
        db,
        ledgerRef,
        ledger: ledgerSnap.data() ?? {},
        month,
        aggregate,
      });
    }

    // New entries only: editing or deleting one never earns a roll.
    const authorRef = (after as { author?: DocumentReference } | undefined)?.author;
    if (!before && authorRef && typeof authorRef.id === "string") {
      await rewardLoggedEntry({
        db,
        ledgerRef,
        authorRef,
      });
    }
  }),
);
