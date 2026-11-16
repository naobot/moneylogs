import { DocumentReference, FieldValue, Firestore, Transaction } from "firebase-admin/firestore";
import { milestoneAchievementId } from "./milestones";

/**
 * Write a milestone knick-knack (source "milestone", so the buddy reveals it and it
 * can't be gifted) and its achievement, inside a transaction the caller has finished
 * reading in.
 */
export const writeMilestone = (
  tx: Transaction,
  userRef: DocumentReference,
  item: string,
  ledgerId: string | null,
) => {
  tx.create(userRef.collection("knickknacks").doc(), {
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
    writeMilestone(tx, userRef, item, (user.get("personalLedgerId") as string | undefined) ?? null);
    return true;
  });
};
