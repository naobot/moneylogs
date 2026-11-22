import { onDocumentWritten } from "firebase-functions/v2/firestore";
import { getFirestore, DocumentReference, Firestore } from "firebase-admin/firestore";
import { affectedMonths, aggregateFieldsChanged, AggregatableEntry } from "./ledgerAggregate";
import { isImportCreate } from "./ledgerImportPlan";
import { alertBudgetsIfCurrent, recomputeMonth } from "./ledgerMonths";
import { rollUpMonth } from "./sublogs";
import { takeDailyChance } from "./knickknackFind";
import { recordCheckIn } from "./checkIn";
import { voidNoSpendDay } from "./noSpend";
import { reportError, withSentry } from "./sentry";

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
 * A sublog's months also roll up into its parent (sublogs.ts): the parent's months/ doc
 * for that month is rebuilt with the sublog's line.
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

    const ledger = ledgerSnap.data() ?? {};
    for (const month of affectedMonths(before, after)) {
      const aggregate = await recomputeMonth(db, ledgerRef, month, {
        withRollups: ledger.hasRollups === true,
      });
      await alertBudgetsIfCurrent({ db, ledgerRef, ledger, month, aggregate });
      // A sublog: the parent's line for this month follows (see sublogs.ts).
      const linkId = (ledger.parentLink as { linkId?: string } | undefined)?.linkId;
      if (linkId) await rollUpMonth(db, linkId, month);
    }

    const authorRef = (after as { author?: DocumentReference } | undefined)?.author;

    // An entry on a day its author confirmed as no-spend (new, or moved onto that day):
    // the day no longer counts. Imports returned above, so history never undoes a day.
    const day = (after as { date?: unknown } | undefined)?.date;
    const dayChanged = !before || (before as { date?: unknown }).date !== day;
    if (dayChanged && typeof day === "string" && authorRef && typeof authorRef.id === "string") {
      try {
        await voidNoSpendDay({ db, userRef: db.collection("users").doc(authorRef.id), day });
      } catch (error) {
        reportError(error, { action: "void_no_spend_day", level: "warning" });
      }
    }

    // New entries only: editing or deleting one never earns a roll.
    if (!before && authorRef && typeof authorRef.id === "string") {
      await rewardLoggedEntry({
        db,
        ledgerRef,
        authorRef,
      });
    }
  }),
);
