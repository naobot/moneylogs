import { FieldValue, Firestore } from "firebase-admin/firestore";
import {
  EngagementAchievementType,
  engagementAchievementId,
  engagementNotificationId,
} from "./engagement";
import { isNotificationEnabled } from "./notificationPrefs";
import { reportError } from "./sentry";

/**
 * Give an engagement achievement unless the person already has it, with a notification
 * unless they've switched those off. Triggers are at-least-once and the check runs in
 * the transaction, so it's never given twice. `userId` is the user doc id.
 */
export const awardEngagementOnce = async ({
  db,
  userId,
  type,
}: {
  db: Firestore;
  userId: string;
  type: EngagementAchievementType;
}): Promise<boolean> => {
  const userRef = db.collection("users").doc(userId);
  const achievementRef = userRef.collection("achievements").doc(engagementAchievementId(type));
  // Most calls come after the first time (every super-lucky check-in, every later gift):
  // a plain read skips the transaction for those.
  if ((await achievementRef.get()).exists) return false;
  return db.runTransaction(async (tx) => {
    const [user, held] = await Promise.all([tx.get(userRef), tx.get(achievementRef)]);
    if (!user.exists || held.exists) return false;
    tx.create(achievementRef, { type, unlockedAt: FieldValue.serverTimestamp() });
    if (isNotificationEnabled(user.data(), "achievement_earned")) {
      tx.set(userRef.collection("notifications").doc(engagementNotificationId(type)), {
        type: "achievement_earned",
        achievement: type,
        createdAt: FieldValue.serverTimestamp(),
        readAt: null,
      });
    }
    return true;
  });
};

/**
 * awardEngagementOnce for a side effect of something else (a gift, a check-in): a
 * failure is reported but never fails what the person actually did.
 */
export const awardEngagementQuietly = (args: Parameters<typeof awardEngagementOnce>[0]) =>
  awardEngagementOnce(args).catch((error) =>
    reportError(error, {
      action: "award_engagement",
      level: "warning",
      extra: { type: args.type },
    }),
  );
