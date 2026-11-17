import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { randomUUID } from "node:crypto";
import { recordCheckIn } from "./checkIn";
import { recomputeMonth } from "./ledger";
import {
  ExistingEntry,
  findPossibleDuplicates,
  importEntryId,
  importMonths,
  parseCheckRows,
  parseImportRequest,
  parseImportRows,
} from "./ledgerImportPlan";
import { reportError, withSentryCall } from "./sentry";

/** gRPC status for a create() on a document that already exists. */
const ALREADY_EXISTS = 6;

/** Firestore's cap on values in one `in` filter. */
const IN_LIMIT = 30;

/**
 * Before an import, tell the preview which rows are already in the ledger, so it can count
 * and show only what's new. Writes nothing.
 *
 * - `alreadyImported`: external ids of rows the caller imported before (their deterministic
 *   entry exists). importLedgerEntries would skip these anyway.
 * - `possibleDuplicates`: the other rows that match an existing entry on day, currency and
 *   amount (a hand-logged copy, another member's import), keyed by external id, with that
 *   entry's note and author so the user can decide.
 */
export const checkLedgerImport = onCall(
  { timeoutSeconds: 60 },
  withSentryCall("checkLedgerImport", async (request) => {
    const uid = request.auth?.uid;
    if (!uid) throw new HttpsError("unauthenticated", "Sign in to import entries.");

    const req = parseImportRequest(request.data);
    if (typeof req === "string") throw new HttpsError("invalid-argument", req);
    const rows = parseCheckRows(req.rows);
    if (typeof rows === "string") throw new HttpsError("invalid-argument", rows);

    const db = getFirestore();
    const ledgerRef = db.collection("ledgers").doc(req.ledgerId);
    const ledger = await ledgerRef.get();
    if (!ledger.exists || ledger.get("deleting") === true) {
      throw new HttpsError("not-found", "That log doesn't exist.");
    }
    if (!((ledger.get("memberUids") ?? []) as string[]).includes(uid)) {
      throw new HttpsError("permission-denied", "Not a member of this log.");
    }

    const entries = ledgerRef.collection("entries");
    const refs = rows.map((row) => entries.doc(importEntryId(req.source, uid, row.externalId)));
    const own = await db.getAll(...refs);
    const alreadyImported = rows.filter((_, i) => own[i].exists).map((r) => r.externalId);
    const ownEntryIds = new Set(own.filter((d) => d.exists).map((d) => d.id));
    const fresh = rows.filter((_, i) => !own[i].exists);

    const months = importMonths(fresh);
    const existing: ExistingEntry[] = [];
    for (let i = 0; i < months.length; i += IN_LIMIT) {
      const snap = await entries.where("month", "in", months.slice(i, i + IN_LIMIT)).get();
      for (const doc of snap.docs) {
        const d = doc.data();
        existing.push({
          id: doc.id,
          date: d.date,
          amount: d.amount,
          currency: d.currency,
          ...(typeof d.note === "string" ? { note: d.note } : {}),
          ...(typeof d.authorName === "string" ? { authorName: d.authorName } : {}),
        });
      }
    }

    return {
      alreadyImported,
      possibleDuplicates: findPossibleDuplicates(fresh, existing, ownEntryIds),
    };
  }),
);

/**
 * Bulk-import spending rows (parsed client-side from a MoneyForward or YNAB export) into a
 * ledger as the caller's entries.
 *
 * - Idempotent: each row's doc id derives from its external id, and rows are written with
 *   create(), so re-importing an overlapping file skips rows that are already there.
 * - Each touched month is recomputed once here; recomputeLedgerMonth skips the per-entry
 *   recompute for these creates.
 * - An import that creates entries counts as logging once (a check-in, and the copper coin
 *   for a first entry). It earns no knick-knack rolls or budget alerts.
 *
 * Returns { created, skippedDuplicates }.
 */
export const importLedgerEntries = onCall(
  { timeoutSeconds: 120, memory: "512MiB" },
  withSentryCall("importLedgerEntries", async (request) => {
    const uid = request.auth?.uid;
    if (!uid) throw new HttpsError("unauthenticated", "Sign in to import entries.");

    const req = parseImportRequest(request.data);
    if (typeof req === "string") throw new HttpsError("invalid-argument", req);

    const db = getFirestore();
    const ledgerRef = db.collection("ledgers").doc(req.ledgerId);
    const ledger = await ledgerRef.get();
    if (!ledger.exists || ledger.get("deleting") === true) {
      throw new HttpsError("not-found", "That log doesn't exist.");
    }
    if (!((ledger.get("memberUids") ?? []) as string[]).includes(uid)) {
      throw new HttpsError("permission-denied", "Not a member of this log.");
    }

    const categories = (ledger.get("categories") ?? []) as Array<{ id?: unknown }>;
    const categoryIds = new Set(
      categories.map((c) => c.id).filter((id): id is string => typeof id === "string"),
    );
    const rows = parseImportRows(req.rows, categoryIds);
    if (typeof rows === "string") throw new HttpsError("invalid-argument", rows);

    const users = await db.collection("users").where("userId", "==", uid).limit(1).get();
    if (users.empty) throw new HttpsError("failed-precondition", "No profile for this account.");
    const user = users.docs[0];
    const authorName = (user.get("displayName") as string | undefined) ?? "";

    const importBatchId = randomUUID();
    const entries = ledgerRef.collection("entries");
    let created = 0;
    let skippedDuplicates = 0;

    const writer = db.bulkWriter();
    // Duplicates are expected; anything else gets the default retries.
    writer.onWriteError((error) =>
      error.code === ALREADY_EXISTS ? false : error.failedAttempts < 5,
    );
    const writes = rows.map((row) => {
      const now = FieldValue.serverTimestamp();
      return writer
        .create(entries.doc(importEntryId(req.source, uid, row.externalId)), {
          amount: row.amount,
          currency: row.currency,
          categoryId: row.categoryId,
          date: row.date,
          month: row.date.slice(0, 7),
          ...(row.note ? { note: row.note } : {}),
          author: user.ref,
          authorUid: uid,
          authorName,
          importSource: req.source,
          importBatchId,
          createdAt: now,
          updatedAt: now,
        })
        .then(
          () => {
            created++;
          },
          (error: { code?: number }) => {
            if (error.code !== ALREADY_EXISTS) throw error;
            skippedDuplicates++;
          },
        );
    });
    await writer.close();
    const results = await Promise.allSettled(writes);
    const failed = results.filter((r) => r.status === "rejected").length;

    // Even on partial failure, keep the summaries in step with whatever did land.
    if (created > 0) {
      for (const month of importMonths(rows)) await recomputeMonth(db, ledgerRef, month);

      // Importing counts as logging entries, once per import: today's check-in, and the
      // copper coin for a first entry if they don't have it yet. No knick-knack roll or
      // budget alerts, which would fire per entry.
      try {
        await recordCheckIn({ db, ledgerRef, userRef: user.ref, loggedEntry: true });
      } catch (error) {
        reportError(error, { action: "check_in", level: "warning" });
      }
    }

    if (failed > 0) {
      reportError(new Error(`${failed}/${rows.length} import writes failed`), {
        action: "import_writes",
        extra: { importBatchId, failed, created, total: rows.length },
      });
      throw new HttpsError(
        "internal",
        `Imported ${created} entries, but ${failed} couldn't be saved. Try importing the file again.`,
      );
    }
    return { created, skippedDuplicates };
  }),
);
