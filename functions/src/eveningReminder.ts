import { onDocumentWritten } from "firebase-functions/v2/firestore";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { FieldValue, getFirestore, Timestamp } from "firebase-admin/firestore";
import { getMessaging } from "firebase-admin/messaging";
import { nextReminderAt, REMINDER_COPY, reminderDay, reminderPath } from "./eveningReminderPlan";
import { deadDevices } from "./pushCopy";
import { reportError, withSentry } from "./sentry";

/** Users handled per hourly run. Anyone left over is still due next hour. */
const USERS_PER_RUN = 300;

const toMillis = (value: unknown): number | undefined =>
  value instanceof Timestamp ? value.toMillis() : undefined;

/**
 * A device registering for push (or re-saving its token, which the app does at every
 * launch) books its owner's next evening reminder, unless one is booked already. From
 * then on each run rebooks the next evening, and a run that finds no devices left lets
 * the booking go.
 */
export const bookEveningReminder = onDocumentWritten(
  "users/{userDocId}/devices/{installId}",
  withSentry("bookEveningReminder", async (event) => {
    if (!event.data?.after.exists) return;
    const db = getFirestore();
    const userRef = db.collection("users").doc(event.params.userDocId);
    await db.runTransaction(async (tx) => {
      const user = await tx.get(userRef);
      if (!user.exists || user.get("checkInReminderDueAt")) return;
      tx.update(userRef, {
        checkInReminderDueAt: Timestamp.fromMillis(
          nextReminderAt(Date.now(), user.get("timezone")),
        ),
      });
    });
  }),
);

/**
 * Hourly: an evening push for anyone with push on who hasn't checked in today, asking
 * whether it was really a no-spend day (eveningReminderPlan.ts has the rules).
 *
 * Due users come from a single-field range on `users.checkInReminderDueAt`, so a run reads
 * only the people whose evening it is (no scan, no composite index), capped per run with
 * the rest picked up next hour. Each is claimed in a transaction that books their next
 * evening and, if a push is going out, stamps remindedDay on their streak marker (server
 * only), so overlapping runs can't push twice.
 *
 * The reminder isn't an inbox notification: it's about today only and would be stale by
 * the time anyone read it there, so it goes straight to the devices.
 */
export const sendEveningReminders = onSchedule(
  { schedule: "every 60 minutes", timeoutSeconds: 540 },
  withSentry("sendEveningReminders", async () => {
    const db = getFirestore();
    const now = Date.now();
    const due = await db
      .collection("users")
      .where("checkInReminderDueAt", "<=", Timestamp.fromMillis(now))
      .limit(USERS_PER_RUN)
      .get();

    let sent = 0;
    for (const snap of due.docs) {
      const userRef = snap.ref;
      try {
        const markerRef = userRef.collection("buddy").doc("streak");
        const claimed = await db.runTransaction(async (tx) => {
          const [user, marker] = await Promise.all([tx.get(userRef), tx.get(markerRef)]);
          const dueAt = toMillis(user.get("checkInReminderDueAt"));
          if (!user.exists || dueAt === undefined || dueAt > now) return null;
          const timezone = user.get("timezone");
          tx.update(userRef, {
            checkInReminderDueAt: Timestamp.fromMillis(nextReminderAt(now, timezone)),
          });
          const day = reminderDay({
            now,
            timezone,
            optIn: user.get("checkInReminder"),
            lastDay: marker.get("lastDay"),
            remindedDay: marker.get("remindedDay"),
          });
          if (!day) return null;
          tx.set(markerRef, { remindedDay: day }, { merge: true });
          return { path: reminderPath(user.get("personalLedgerId")) };
        });

        const devices = (await userRef.collection("devices").get()).docs.filter(
          (d) => typeof d.get("token") === "string",
        );
        if (!devices.length) {
          // Push is off on every phone: stop booking until a device registers again.
          await userRef.update({ checkInReminderDueAt: FieldValue.delete() });
          continue;
        }
        if (!claimed) continue;

        const response = await getMessaging().sendEachForMulticast({
          tokens: devices.map((d) => d.get("token") as string),
          notification: { ...REMINDER_COPY },
          data: { path: claimed.path },
          apns: { payload: { aps: { sound: "default" } } },
        });
        sent += 1;
        const dead = new Set(
          deadDevices(
            devices.map((d) => d.id),
            response.responses,
          ),
        );
        await Promise.all(devices.filter((d) => dead.has(d.id)).map((d) => d.ref.delete()));
      } catch (err) {
        reportError(err, { action: "send_evening_reminder", extra: { userDocId: snap.id } });
      }
    }
    console.log(`sendEveningReminders: ${due.size} due, ${sent} reminded`);
  }),
);
