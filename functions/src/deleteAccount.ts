import { onCall, HttpsError } from "firebase-functions/v2/https";
import {
  BulkWriter,
  DocumentData,
  DocumentReference,
  FieldValue,
  Firestore,
  getFirestore,
} from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";
import {
  DELETED_USER_NAME,
  isRecentSignIn,
  planLedgerExit,
  planPostCleanup,
  planSocialExit,
} from "./deleteAccountPlan";
import { commentNotificationId, notificationRecipients } from "./notifications";
import { purgeLog } from "./purgeLog";

type Failures = { count: number; record: (what: string) => (err: unknown) => void };

const trackFailures = (): Failures => {
  const failures: Failures = {
    count: 0,
    record: (what) => (err) => {
      failures.count++;
      console.error(`deleteAccount: failed to ${what}:`, err);
    },
  };
  return failures;
};

/** Firestore `in` queries take at most 30 values; users have one doc in practice. */
const IN_LIMIT = 30;

/**
 * Anonymise the person's footprint in a social log that stays for its other members:
 * author names on their posts and comments, their reactions and comment subscriptions,
 * the cached analytics names, and the comment notifications they caused in others' inboxes.
 * (Removing reactions also lets notifyOnReaction delete those reaction notifications.)
 */
const anonymiseInGroup = async (
  db: Firestore,
  bulk: BulkWriter,
  failures: Failures,
  groupRef: DocumentReference,
  groupData: DocumentData,
  userRefs: DocumentReference[],
  userDocIds: ReadonlySet<string>,
) => {
  const posts = await db.collection("log_posts").where("group", "==", groupRef).get();
  const analyticsPosts = (groupData.analytics?.posts ?? {}) as Record<string, unknown>;
  const groupUpdate: Record<string, unknown> = {};

  for (const post of posts.docs) {
    const data = post.data();
    const cleanup = planPostCleanup(data, userDocIds);
    if (cleanup) {
      const update: Record<string, unknown> = {};
      for (const key of cleanup.reactionKeys) update[`reactions.${key}`] = FieldValue.delete();
      if (cleanup.unsubscribe) update.commentSubscribers = FieldValue.arrayRemove(...userRefs);
      if (cleanup.isAuthor) update.authorName = DELETED_USER_NAME;
      bulk.update(post.ref, update).catch(failures.record(`clean up post ${post.id}`));
    }
    const authorId = (data.author as DocumentReference | undefined)?.id;
    if (authorId && userDocIds.has(authorId) && post.id in analyticsPosts) {
      groupUpdate[`analytics.posts.${post.id}.authorDisplayName`] = DELETED_USER_NAME;
    }

    if (!data.commentCount) continue;
    const comments = await post.ref
      .collection("comments")
      .where("authorId", "in", userRefs.slice(0, IN_LIMIT))
      .get();
    // Everyone who was notified about these comments (author and subscribers).
    const recipients = notificationRecipients(data, "").filter((id) => !userDocIds.has(id));
    for (const comment of comments.docs) {
      if (comment.data().authorName !== DELETED_USER_NAME) {
        bulk
          .update(comment.ref, { authorName: DELETED_USER_NAME })
          .catch(failures.record(`anonymise comment ${comment.id}`));
      }
      for (const recipient of recipients) {
        bulk
          .delete(
            db
              .collection("users")
              .doc(recipient)
              .collection("notifications")
              .doc(commentNotificationId(comment.id)),
          )
          .catch(failures.record(`delete comment notification for ${recipient}`));
      }
    }
  }

  if (Object.keys(groupUpdate).length) {
    bulk.update(groupRef, groupUpdate).catch(failures.record(`anonymise analytics ${groupRef.id}`));
  }
};

/** Auth uid behind a user doc, for passing on a log's creatorship. */
const uidOfUserDoc = async (db: Firestore, userDocId: string): Promise<string | undefined> => {
  const snap = await db.collection("users").doc(userDocId).get();
  const uid = snap.data()?.userId;
  return typeof uid === "string" && uid ? uid : undefined;
};

/**
 * Permanently delete the caller's account: logs they're alone in are deleted, shared logs
 * stay for the other members with the caller's content anonymised, then their user doc
 * (with achievements and notifications) and finally their Auth account are removed.
 *
 * Requires a sign-in within the last few minutes (the client re-authenticates first).
 * Safe to retry: each log's membership is removed only after its content is anonymised,
 * and the Auth account goes last, so a failed run can be finished by calling again.
 */
export const deleteAccount = onCall({ timeoutSeconds: 540, memory: "512MiB" }, async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError("unauthenticated", "Sign in to delete your account.");
  if (!isRecentSignIn(request.auth?.token.auth_time, Math.floor(Date.now() / 1000))) {
    throw new HttpsError(
      "failed-precondition",
      "Please confirm your password again before deleting your account.",
    );
  }

  const db = getFirestore();
  const userDocs = (await db.collection("users").where("userId", "==", uid).get()).docs;
  const userRefs = userDocs.map((d) => d.ref);
  const userDocIds = new Set(userRefs.map((r) => r.id));
  const failures = trackFailures();
  const stats = { purged: 0, left: 0 };

  // Social logs: from the user docs' `groups` lists and from membership.
  const groupIds = new Set<string>();
  for (const doc of userDocs) {
    for (const id of (doc.data().groups ?? []) as unknown[]) {
      if (typeof id === "string" && id) groupIds.add(id);
    }
  }
  for (const ref of userRefs) {
    const memberOf = await db
      .collection("log_groups")
      .where("members", "array-contains", ref)
      .get();
    for (const d of memberOf.docs) groupIds.add(d.id);
  }

  for (const groupId of groupIds) {
    const groupRef = db.collection("log_groups").doc(groupId);
    const snap = await groupRef.get();
    if (!snap.exists) continue;
    const data = snap.data() as DocumentData;
    const plan = planSocialExit(data, uid, userDocIds);

    if (plan.action === "purge") {
      await purgeLog(db, "social", groupId, data);
      stats.purged++;
    } else if (plan.action === "leave") {
      const bulk = db.bulkWriter();
      await anonymiseInGroup(db, bulk, failures, groupRef, data, userRefs, userDocIds);
      await bulk.close();
      if (failures.count) break;

      const update: Record<string, unknown> = { members: FieldValue.arrayRemove(...userRefs) };
      if (plan.transferCreator) {
        const next = await uidOfUserDoc(db, plan.remainingMemberIds[0]);
        update.createdBy = next ?? FieldValue.delete();
      }
      await groupRef.update(update);
      stats.left++;
    }
  }

  // Financial logs (including the personal one).
  if (!failures.count) {
    const ledgers = await db.collection("ledgers").where("memberUids", "array-contains", uid).get();
    for (const ledger of ledgers.docs) {
      const plan = planLedgerExit(ledger.data(), uid, userDocIds);
      if (plan.action === "purge") {
        await purgeLog(db, "financial", ledger.id, ledger.data());
        stats.purged++;
        continue;
      }
      if (plan.action !== "leave") continue;

      const entries = await ledger.ref.collection("entries").where("authorUid", "==", uid).get();
      const bulk = db.bulkWriter();
      for (const entry of entries.docs) {
        if (entry.data().authorName === DELETED_USER_NAME) continue;
        bulk
          .update(entry.ref, { authorName: DELETED_USER_NAME })
          .catch(failures.record(`anonymise entry ${entry.id}`));
      }
      await bulk.close();
      if (failures.count) break;

      // Re-plan inside a transaction: someone may have joined since the read above.
      await db.runTransaction(async (tx) => {
        const fresh = await tx.get(ledger.ref);
        if (!fresh.exists) return;
        const freshPlan = planLedgerExit(fresh.data() as DocumentData, uid, userDocIds);
        if (freshPlan.action !== "leave") return;
        tx.update(ledger.ref, {
          members: freshPlan.members,
          memberUids: freshPlan.memberUids,
          ...(freshPlan.createdBy ? { createdBy: freshPlan.createdBy } : {}),
        });
      });
      stats.left++;
    }
  }

  // Posts they wrote in logs they'd already left (author names only).
  if (!failures.count && userRefs.length) {
    const authored = await db
      .collection("log_posts")
      .where("author", "in", userRefs.slice(0, IN_LIMIT))
      .get();
    const bulk = db.bulkWriter();
    for (const post of authored.docs) {
      if (post.data().authorName === DELETED_USER_NAME) continue;
      bulk
        .update(post.ref, { authorName: DELETED_USER_NAME })
        .catch(failures.record(`anonymise post ${post.id}`));
    }
    await bulk.close();
  }

  if (failures.count) {
    // The user doc and Auth account still exist, so calling again finishes the job.
    throw new HttpsError("internal", "Some of your data couldn't be removed. Please try again.");
  }

  // The user docs with their achievements and notifications, then the Auth account.
  for (const ref of userRefs) await db.recursiveDelete(ref);
  try {
    await getAuth().deleteUser(uid);
  } catch (err) {
    if ((err as { code?: string })?.code !== "auth/user-not-found") throw err;
  }

  console.log(
    `deleteAccount: ${uid}; ${userRefs.length} user docs, ${stats.purged} logs deleted, ${stats.left} logs left`,
  );
  return { deleted: true, logsDeleted: stats.purged, logsLeft: stats.left };
});
