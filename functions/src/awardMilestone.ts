import { DocumentSnapshot, FieldValue, Firestore, Transaction } from "firebase-admin/firestore";
import { milestoneAchievementId, milestoneNotificationId } from "./milestones";
import { isNotificationEnabled } from "./notificationPrefs";

/**
 * Write a milestone knick-knack (source "milestone", so the buddy reveals it and it
 * can't be gifted), its achievement and, unless they've switched it off, a notification,
 * inside a transaction the caller has finished reading in. `user` is the person's user
 * doc, read in that transaction.
 */
export const writeMilestone = (
  tx: Transaction,
  user: DocumentSnapshot,
  item: string,
  ledgerId: string | null,
) => {
  const userRef = user.ref;
  const findRef = userRef.collection("knickknacks").doc();
  tx.create(findRef, {
    item,
    ledgerId,
    foundAt: FieldValue.serverTimestamp(),
    seenAt: null,
    source: "milestone",
  });
  tx.set(userRef.collection("achievements").doc(milestoneAchievementId(item)), {
    type: item,
    ...(ledgerId ? { ledgerId } : {}),
    unlockedAt: FieldValue.serverTimestamp(),
  });
  // What the knick-knack is stays a surprise for the buddy to reveal: the notification
  // names the achievement only.
  if (isNotificationEnabled(user.data(), "milestone_earned")) {
    tx.set(userRef.collection("notifications").doc(milestoneNotificationId(item)), {
      type: "milestone_earned",
      item,
      findId: findRef.id,
      createdAt: FieldValue.serverTimestamp(),
      readAt: null,
    });
  }
};

/**
 * Give a one-off milestone unless the person already has its achievement. Triggers are
 * at-least-once, and the check runs in the transaction, so it's never given twice.
 * The buddy in the person's personal log shows it to them (any buddy would, but the
 * drawer points there).
 */
export const awardMilestoneOnce = async ({
  db,
  userId,
  item,
}: {
  db: Firestore;
  userId: string;
  item: string;
}): Promise<boolean> => {
  const userRef = db.collection("users").doc(userId);
  const achievementRef = userRef.collection("achievements").doc(milestoneAchievementId(item));
  return db.runTransaction(async (tx) => {
    const [user, held] = await Promise.all([tx.get(userRef), tx.get(achievementRef)]);
    if (!user.exists || held.exists) return false;
    writeMilestone(tx, user, item, (user.get("personalLedgerId") as string | undefined) ?? null);
    return true;
  });
};
