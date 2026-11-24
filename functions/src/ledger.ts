import { onDocumentWritten } from "firebase-functions/v2/firestore";
import { getFirestore, DocumentReference, Firestore } from "firebase-admin/firestore";
import { affectedMonths, aggregateFieldsChanged, AggregatableEntry } from "./ledgerAggregate";
import { isImportCreate } from "./ledgerImportPlan";
import { isScheduledEntry } from "./schedulePlan";
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
 *
 * Entries a scheduled payment logs (logScheduledEntries) recompute and alert like any other,
 * but earn no check-in or roll and never void a no-spend day, even when edited later.
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
    const months = affectedMonths(before, after);
    for (const month of months) {
      const aggregate = await recomputeMonth(db, ledgerRef, month);
      await alertBudgetsIfCurrent({ db, ledgerRef, ledger, month, aggregate });
    }
    // A sublog: its parent's line follows (see sublogs.ts). The link is read now, after the
    // months are saved, not from the snapshot above: a link made in between backfills only
    // the months that were already saved.
    if ((await ledgerRef.get()).get("parentLink")) {
      for (const month of months) await rollUpMonth(db, ledgerId, month);
    }

    const authorRef = (after as { author?: DocumentReference } | undefined)?.author;

    // A scheduled payment's entry (logScheduledEntries), being logged or edited later:
    // nobody logged it by hand, so it's no check-in, no roll, and it leaves a confirmed
    // no-spend day alone, even when it's moved onto that day.
    if (isScheduledEntry(after as { scheduleId?: unknown } | undefined)) return;

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
