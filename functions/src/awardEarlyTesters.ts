import { onSchedule } from "firebase-functions/v2/scheduler";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { awardMilestoneOnce } from "./awardMilestone";
import {
  dueForAwards,
  parseTesterWindow,
  TESTER_GEARS,
  TesterMarker,
  testerGear,
} from "./earlyTesters";
import { reportError, withSentry } from "./sentry";

/**
 * Once the Android closed test's window (config/app.testerWindow) has closed, give each
 * tester counted at users/{id}/testing/android their one gear (earlyTesters.ts), the same
 * way as any milestone: achievement, notification, and a find for the buddy to reveal.
 * Then mark the window done with `awardedAt`. If any award fails, `awardedAt` stays unset
 * and the next day's run tries again; anyone already holding a gear is skipped.
 */
export const awardEarlyTesters = onSchedule(
  { schedule: "every day 00:30", timeZone: "UTC", timeoutSeconds: 540 },
  withSentry("awardEarlyTesters", async () => {
    const db = getFirestore();
    const configRef = db.collection("config").doc("app");
    const window = parseTesterWindow((await configRef.get()).data());
    if (!dueForAwards(window, Date.now())) return;

    // Only tester markers live in `testing` collections, so this reads nothing else.
    const testers = await db.collectionGroup("testing").get();
    let given = 0;
    let failed = 0;
    for (const marker of testers.docs) {
      const userRef = marker.ref.parent.parent;
      if (marker.id !== "android" || !userRef) continue;
      try {
        const awarded = await awardMilestoneOnce({
          db,
          userId: userRef.id,
          item: testerGear(marker.data() as TesterMarker),
          unlessHeld: TESTER_GEARS,
        });
        if (awarded) given++;
      } catch (error) {
        failed++;
        reportError(error, { action: "award_tester_gear", extra: { userDocId: userRef.id } });
      }
    }

    console.log(`awardEarlyTesters: ${testers.size} testers, ${given} given, ${failed} failed`);
    if (!failed) await configRef.update({ "testerWindow.awardedAt": FieldValue.serverTimestamp() });
  }),
);
