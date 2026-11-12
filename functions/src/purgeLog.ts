import { HttpsError } from "firebase-functions/v2/https";
import { DocumentData, DocumentReference, FieldValue, Firestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import { LogKind, storagePrefixes, uniqueDocIds, userFieldsToDelete } from "./deleteLogPlan";

export type PurgeResult = { posts: number; participants: number };

/**
 * Permanently delete a log (social group or financial ledger) and every reference to it:
 * posts and comments, participants' bookkeeping, achievements and notifications, images,
 * and finally the log document itself. Callers check who may do this.
 *
 * Safe to retry: the log document is removed last (ledgers stay flagged `deleting`), so a
 * partial failure can be finished by calling again.
 */
export const purgeLog = async (
  db: Firestore,
  kind: LogKind,
  id: string,
  data: DocumentData,
): Promise<PurgeResult> => {
  const logRef = db.collection(kind === "financial" ? "ledgers" : "log_groups").doc(id);
  const bulk = db.bulkWriter();
  // BulkWriter's flush() resolves even when individual writes fail, so record failures.
  let failedWrites = 0;
  const NOT_FOUND = 5;
  const recordFailure = (what: string) => (err: unknown) => {
    failedWrites++;
    console.error(`purgeLog: failed to ${what}:`, err);
  };
  const memberRefs = (data.members ?? []) as DocumentReference[];
  let postIds: string[] = [];
  let participantIds: string[];

  if (kind === "financial") {
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
    bulk.delete(db.collection("processing").doc(id)).catch(recordFailure("delete processing doc"));
  }

  // Participants' bookkeeping, achievements and notifications for this log.
  const fieldsToDelete = userFieldsToDelete(id, postIds);
  for (const userDocId of participantIds) {
    const userRef = db.collection("users").doc(userDocId);
    const update: Record<string, FieldValue> = { groups: FieldValue.arrayRemove(id) };
    for (const path of fieldsToDelete) update[path] = FieldValue.delete();
    bulk.update(userRef, update).catch((err) => {
      // A participant whose user doc is gone has nothing to clean up.
      if (err?.code !== NOT_FOUND) {
        failedWrites++;
        console.error(`purgeLog: failed to clean up user ${userDocId}:`, err);
      }
    });
    const achievements = await userRef.collection("achievements").where("groupId", "==", id).get();
    for (const d of achievements.docs) {
      bulk.delete(d.ref).catch(recordFailure(`delete achievement ${d.id}`));
    }
    // Notifications about this log's posts (comment and reaction fan-out).
    const notifications = await userRef
      .collection("notifications")
      .where("groupId", "==", id)
      .get();
    for (const d of notifications.docs) {
      bulk.delete(d.ref).catch(recordFailure(`delete notification ${d.id}`));
    }
  }
  await bulk.flush();
  if (failedWrites > 0) {
    // The log document still exists, so calling again finishes the job.
    await bulk.close();
    throw new HttpsError("internal", "Some references couldn't be removed. Please try again.");
  }

  if (kind === "social") {
    const bucket = getStorage().bucket();
    for (const prefix of storagePrefixes(id)) {
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

  return { posts: postIds.length, participants: participantIds.length };
};
