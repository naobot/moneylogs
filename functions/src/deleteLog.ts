import { onCall, HttpsError } from "firebase-functions/v2/https";
import {
  getFirestore,
  FieldValue,
  DocumentReference,
  DocumentData,
} from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import {
  parseDeleteLogRequest,
  resolveCreator,
  storagePrefixes,
  uniqueDocIds,
  userFieldsToDelete,
} from "./deleteLogPlan";

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

  const bulk = db.bulkWriter();
  // BulkWriter's flush() resolves even when individual writes fail, so record failures.
  let failedWrites = 0;
  const NOT_FOUND = 5;
  const recordFailure = (what: string) => (err: unknown) => {
    failedWrites++;
    console.error(`deleteLog: failed to ${what}:`, err);
  };
  const memberRefs = (data.members ?? []) as DocumentReference[];
  let postIds: string[] = [];
  let participantIds: string[];

  if (req.kind === "financial") {
    // Stop recomputeLedgerMonth (and new entries, via rules) before removing entries.
    await logRef.update({ deleting: true });
    participantIds = uniqueDocIds(memberRefs);
  } else {
    const posts = await db.collection("log_posts").where("group", "==", logRef).get();
    postIds = posts.docs.map((d) => d.id);
    const subscribers = posts.docs.flatMap(
      (d) => (d.data().commentSubscribers ?? []) as DocumentReference[],
    );
    const authors = posts.docs.map((d) => d.data().author as DocumentReference | undefined);
    participantIds = uniqueDocIds(memberRefs, subscribers, authors);

    // Posts and their comment subcollections.
    for (const post of posts.docs) await db.recursiveDelete(post.ref, bulk);
    bulk
      .delete(db.collection("processing").doc(req.id))
      .catch(recordFailure("delete processing doc"));
  }

  // Participants' bookkeeping, achievements and notifications for this log.
  const fieldsToDelete = userFieldsToDelete(req.id, postIds);
  for (const userDocId of participantIds) {
    const userRef = db.collection("users").doc(userDocId);
    const update: Record<string, FieldValue> = { groups: FieldValue.arrayRemove(req.id) };
    for (const path of fieldsToDelete) update[path] = FieldValue.delete();
    bulk.update(userRef, update).catch((err) => {
      // A participant whose user doc is gone has nothing to clean up.
      if (err?.code !== NOT_FOUND) {
        failedWrites++;
        console.error(`deleteLog: failed to clean up user ${userDocId}:`, err);
      }
    });
    const achievements = await userRef
      .collection("achievements")
      .where("groupId", "==", req.id)
      .get();
    for (const d of achievements.docs) {
      bulk.delete(d.ref).catch(recordFailure(`delete achievement ${d.id}`));
    }
    // Notifications about this log's posts (comment and reaction fan-out).
    const notifications = await userRef
      .collection("notifications")
      .where("groupId", "==", req.id)
      .get();
    for (const d of notifications.docs) {
      bulk.delete(d.ref).catch(recordFailure(`delete notification ${d.id}`));
    }
  }
  await bulk.flush();
  if (failedWrites > 0) {
    // The log document still exists, so calling again finishes the job.
    throw new HttpsError("internal", "Some references couldn't be removed. Please try again.");
  }

  if (req.kind === "social") {
    const bucket = getStorage().bucket();
    for (const prefix of storagePrefixes(req.id)) {
      try {
        await bucket.deleteFiles({ prefix });
      } catch (err) {
        console.warn(`Could not delete storage prefix ${prefix}:`, err);
      }
    }
  }

  // Last: the log itself (for ledgers, also entries and months).
  await db.recursiveDelete(logRef, bulk);
  await bulk.close();

  console.log(
    `deleteLog: ${req.kind} ${req.id} by ${uid}; ${postIds.length} posts, ${participantIds.length} participants`,
  );
  return { deleted: true, posts: postIds.length, participants: participantIds.length };
});
