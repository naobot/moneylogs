import { onSchedule } from "firebase-functions/v2/scheduler";
import { DocumentReference, getFirestore } from "firebase-admin/firestore";
import { getMessaging } from "firebase-admin/messaging";
import { REMINDER_COPY, reminderDay, reminderPath } from "./eveningReminderPlan";
import { deadDevices } from "./pushCopy";
import { reportError, withSentry } from "./sentry";

/**
 * Hourly: an evening push for anyone with push on who hasn't checked in today, asking
 * whether it was really a no-spend day (eveningReminderPlan.ts has the rules). Only
 * people with a registered device are read, through the devices collection group, so the
 * run costs nothing for web-only users. Each person is claimed for the day in a
 * transaction (remindedDay on their streak marker, which only the server reads) before
 * sending, so overlapping runs can't push twice.
 *
 * The reminder isn't an inbox notification: it's about today only and would be stale by
 * the time anyone read it there, so it goes straight to the devices.
 */
export const sendEveningReminders = onSchedule(
  { schedule: "every 60 minutes", timeoutSeconds: 300 },
  withSentry("sendEveningReminders", async () => {
    const db = getFirestore();
    const now = Date.now();
    const devices = await db.collectionGroup("devices").get();

    // Device docs live at users/{userDocId}/devices/{installId}.
    const byUser = new Map<string, { userRef: DocumentReference; docs: typeof devices.docs }>();
    for (const device of devices.docs) {
      const userRef = device.ref.parent.parent;
      if (!userRef || userRef.parent.id !== "users") continue;
      if (typeof device.get("token") !== "string") continue;
      const entry = byUser.get(userRef.path) ?? { userRef, docs: [] };
      entry.docs.push(device);
      byUser.set(userRef.path, entry);
    }

    let sent = 0;
    for (const { userRef, docs } of byUser.values()) {
      try {
        const markerRef = userRef.collection("buddy").doc("streak");
        const claimed = await db.runTransaction(async (tx) => {
          const [user, marker] = await Promise.all([tx.get(userRef), tx.get(markerRef)]);
          if (!user.exists) return null;
          const day = reminderDay({
            now,
            timezone: user.get("timezone"),
            optIn: user.get("checkInReminder"),
            lastDay: marker.get("lastDay"),
            remindedDay: marker.get("remindedDay"),
          });
          if (!day) return null;
          tx.set(markerRef, { remindedDay: day }, { merge: true });
          return { path: reminderPath(user.get("personalLedgerId")) };
        });
        if (!claimed) continue;

        const response = await getMessaging().sendEachForMulticast({
          tokens: docs.map((d) => d.get("token") as string),
          notification: { ...REMINDER_COPY },
          data: { path: claimed.path },
          apns: { payload: { aps: { sound: "default" } } },
        });
        sent += 1;
        const dead = new Set(
          deadDevices(
            docs.map((d) => d.id),
            response.responses,
          ),
        );
        await Promise.all(docs.filter((d) => dead.has(d.id)).map((d) => d.ref.delete()));
      } catch (err) {
        reportError(err, { action: "send_evening_reminder", extra: { userDocId: userRef.id } });
      }
    }
    console.log(`sendEveningReminders: ${byUser.size} with push, ${sent} reminded`);
  }),
);
