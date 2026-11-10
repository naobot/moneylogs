import { onDocumentUpdated } from "firebase-functions/v2/firestore";
import { getFirestore, FieldValue, WriteBatch } from "firebase-admin/firestore";
import {
  buildReactionNotification,
  chunk,
  diffReactions,
  NotifiablePost,
  notificationRecipients,
  reactionNotificationId,
} from "./notifications";

/**
 * Fan out reaction notifications. Fires on every post update (comment counts, image
 * processing, edits too), so it exits before any reads unless `reactions` changed.
 * Added reactions notify the post's author and comment subscribers; removed ones delete
 * the matching notifications by their deterministic id.
 */
export const notifyOnReaction = onDocumentUpdated("log_posts/{postId}", async (event) => {
  const before = event.data?.before.data();
  const after = event.data?.after.data();
  if (!after) return;

  const { added, removed } = diffReactions(before?.reactions, after.reactions);
  if (!added.length && !removed.length) return;

  const { postId } = event.params;
  const post = after as NotifiablePost;
  const db = getFirestore();
  const notificationsOf = (userId: string) =>
    db.collection("users").doc(userId).collection("notifications");

  // Display names for everyone who just reacted (usually one person).
  const actorIds = [...new Set(added.map((change) => change.userId))];
  const actorNames = new Map<string, string>();
  await Promise.all(
    actorIds.map(async (id) => {
      const snap = await db.collection("users").doc(id).get();
      actorNames.set(id, (snap.data()?.displayName as string | undefined) ?? "Someone");
    }),
  );

  const writes: Array<(batch: WriteBatch) => void> = [];
  const createdAt = FieldValue.serverTimestamp();

  for (const { userId, emoji } of added) {
    const data = buildReactionNotification({
      post,
      postId,
      actorId: userId,
      actorName: actorNames.get(userId) ?? "Someone",
      emoji,
    });
    const id = reactionNotificationId(postId, userId, emoji);
    for (const recipient of notificationRecipients(post, userId)) {
      writes.push((batch) =>
        batch.set(notificationsOf(recipient).doc(id), { ...data, createdAt, readAt: null }),
      );
    }
  }

  for (const { userId, emoji } of removed) {
    const id = reactionNotificationId(postId, userId, emoji);
    // Deleting a doc that doesn't exist is a no-op, so recipients needn't be exact.
    for (const recipient of notificationRecipients(post, userId)) {
      writes.push((batch) => batch.delete(notificationsOf(recipient).doc(id)));
    }
  }

  try {
    for (const group of chunk(writes)) {
      const batch = db.batch();
      group.forEach((write) => write(batch));
      await batch.commit();
    }
    console.log(
      `notifyOnReaction: post ${postId}, +${added.length} -${removed.length}, ${writes.length} writes`,
    );
  } catch (error) {
    console.error("notifyOnReaction: error writing notifications:", error);
  }
});
