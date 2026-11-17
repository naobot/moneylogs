import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { randomUUID } from "node:crypto";
import { recomputeMonth } from "./ledger";
import {
  importEntryId,
  importMonths,
  parseImportRequest,
  parseImportRows,
} from "./ledgerImportPlan";

/** gRPC status for a create() on a document that already exists. */
const ALREADY_EXISTS = 6;

/**
 * Bulk-import spending rows (parsed client-side from a MoneyForward or YNAB export) into a
 * ledger as the caller's entries.
 *
 * - Idempotent: each row's doc id derives from its external id, and rows are written with
 *   create(), so re-importing an overlapping file skips rows that are already there.
 * - Each touched month is recomputed once here; recomputeLedgerMonth skips the per-entry
 *   recompute for these creates, and imports earn no check-ins, knick-knacks or alerts.
 *
 * Returns { created, skippedDuplicates }.
 */
export const importLedgerEntries = onCall(
  { timeoutSeconds: 120, memory: "512MiB" },
  async (request) => {
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
    }

    if (failed > 0) {
      console.error(`importLedgerEntries: ${failed}/${rows.length} writes failed`, {
        ledgerId: req.ledgerId,
        importBatchId,
      });
      throw new HttpsError(
        "internal",
        `Imported ${created} entries, but ${failed} couldn't be saved. Try importing the file again.`,
      );
    }
    return { created, skippedDuplicates };
  },
);
