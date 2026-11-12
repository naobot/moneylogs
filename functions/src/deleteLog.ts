import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore, DocumentData } from "firebase-admin/firestore";
import { parseDeleteLogRequest, resolveCreator } from "./deleteLogPlan";
import { purgeLog } from "./purgeLog";

/**
 * Permanently delete a log (social group or financial ledger) and every reference to it.
 * Only the log's creator may call this. Runs with the Admin SDK because security rules
 * can't express the cascade (and clients can't delete processed images).
 *
 * Safe to retry: the log document is removed last (ledgers stay flagged `deleting`), so a
 * partial failure can be finished by calling again.
 */
export const deleteLog = onCall({ timeoutSeconds: 300, memory: "512MiB" }, async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError("unauthenticated", "Sign in to delete a log.");

  const req = parseDeleteLogRequest(request.data);
  if (!req) throw new HttpsError("invalid-argument", "Expected { kind, id }.");

  const db = getFirestore();
  const logRef = db.collection(req.kind === "financial" ? "ledgers" : "log_groups").doc(req.id);
  const snap = await logRef.get();
  if (!snap.exists) throw new HttpsError("not-found", "That log doesn't exist.");
  const data = snap.data() as DocumentData;

  const creator = resolveCreator(req.kind, data);
  if (!creator) {
    throw new HttpsError(
      "failed-precondition",
      "This log's creator isn't recorded yet, so it can't be deleted.",
    );
  }
  if (creator !== uid) {
    throw new HttpsError(
      "permission-denied",
      "Only the person who created this log can delete it.",
    );
  }

  const { posts, participants } = await purgeLog(db, req.kind, req.id, data);

  console.log(
    `deleteLog: ${req.kind} ${req.id} by ${uid}; ${posts} posts, ${participants} participants`,
  );
  return { deleted: true, posts, participants };
});
