import { onDocumentWritten } from "firebase-functions/v2/firestore";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { FieldValue, getFirestore, Timestamp } from "firebase-admin/firestore";
import { dayIn } from "./knickknacks";
import { isNotificationEnabled } from "./notificationPrefs";
import {
  dueDays,
  dueInstant,
  nextOccurrence,
  parseSchedule,
  scheduleCategoryState,
  scheduleEntryId,
  ScheduleRepeat,
} from "./schedulePlan";
import { reportError, withSentry } from "./sentry";
import { zoneOrUtc } from "./zones";

/** Schedules handled per hourly run. Anything left over is still due next hour. */
const SCHEDULES_PER_RUN = 300;

const sameRepeat = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b);

/**
 * Books a scheduled payment's next due day (`nextDue`, and `nextDueAt`, the instant the
 * hourly run picks it up) whenever it's created, its repeat changes or it's unpaused, and
 * clears the booking while it's paused. Clients never write these fields (rules).
 *
 * A new or changed booking starts from tomorrow in the owner's zone, never today: someone
 * setting up rent on the day it's due has usually paid (and logged) it already. Days spent
 * paused aren't caught up either.
 *
 * The run's own writes (nextDue moving on) change neither repeat nor paused, so they don't
 * come back through here.
 */
export const bookSchedule = onDocumentWritten(
  "ledgers/{ledgerId}/schedules/{scheduleId}",
  withSentry("bookSchedule", async (event) => {
    const after = event.data?.after;
    if (!after?.exists) return;
    const before = event.data?.before;
    const schedule = parseSchedule(after.data());
    if (!schedule) return;

    if (schedule.paused) {
      if (after.get("nextDueAt") !== undefined || after.get("nextDue") !== undefined) {
        await after.ref.update({
          nextDue: FieldValue.delete(),
          nextDueAt: FieldValue.delete(),
        });
      }
      return;
    }

    const needsBooking =
      !before?.exists ||
      before.get("paused") === true ||
      !sameRepeat(before.get("repeat"), after.get("repeat")) ||
      after.get("nextDueAt") === undefined;
    if (!needsBooking) return;

    const db = getFirestore();
    const owner = await db.collection("users").doc(schedule.ownerDocId).get();
    const timezone = zoneOrUtc(owner.get("timezone"));
    const nextDue = nextOccurrence(schedule.repeat, dayIn(Date.now(), timezone));
    await after.ref.update({
      nextDue,
      nextDueAt: Timestamp.fromMillis(dueInstant(nextDue, timezone)),
    });
  }),
);

type Logged = {
  ownerDocId: string;
  notification: Record<string, unknown> & { id: string };
};

/**
 * Hourly: logs every scheduled payment whose day has come, as an entry by the person who
 * set it up, and tells them (a scheduled_logged notification) so they can fix the amount
 * if the bill changed.
 *
 * Due schedules come from a single-field collection-group range on `nextDueAt`
 * (firestore.indexes.json), so a run reads only what's due. Each is claimed in a
 * transaction that writes its entries and moves nextDue on, so overlapping runs can't log
 * twice; the entry ids are fixed per schedule and day as well (scheduleEntryId).
 *
 * The entries then go through recomputeLedgerMonth like any other (month totals, budget
 * alerts, sublog roll-ups), minus the rewards: nobody logged them by hand.
 *
 * A schedule whose owner has left the log, or whose log or category is gone, is deleted;
 * one whose category was archived or is no longer fixed is paused.
 */
export const logScheduledEntries = onSchedule(
  { schedule: "every 60 minutes", timeoutSeconds: 540 },
  withSentry("logScheduledEntries", async () => {
    const db = getFirestore();
    const now = Date.now();
    const due = await db
      .collectionGroup("schedules")
      .where("nextDueAt", "<=", Timestamp.fromMillis(now))
      .limit(SCHEDULES_PER_RUN)
      .get();

    let entries = 0;
    for (const snap of due.docs) {
      const scheduleRef = snap.ref;
      const ledgerRef = scheduleRef.parent.parent;
      if (!ledgerRef) continue;
      try {
        const logged = await db.runTransaction(async (tx): Promise<Logged[]> => {
          const current = await tx.get(scheduleRef);
          const dueAt = current.get("nextDueAt");
          if (!current.exists || !(dueAt instanceof Timestamp) || dueAt.toMillis() > now) {
            return [];
          }
          const schedule = parseSchedule(current.data());
          const ledger = await tx.get(ledgerRef);
          if (!schedule || !ledger.exists) {
            tx.delete(scheduleRef);
            return [];
          }
          // deleteLog removes the schedules with the rest of the log.
          if (ledger.get("deleting") === true) return [];

          const ownerRef = db.collection("users").doc(schedule.ownerDocId);
          const owner = await tx.get(ownerRef);
          const memberUids = (ledger.get("memberUids") ?? []) as unknown[];
          if (!owner.exists || !memberUids.includes(schedule.ownerUid)) {
            tx.delete(scheduleRef);
            return [];
          }

          const categories = (ledger.get("categories") ?? []) as Array<Record<string, unknown>>;
          const state = scheduleCategoryState(categories, schedule.categoryId);
          if (state === "drop") {
            tx.delete(scheduleRef);
            return [];
          }
          if (state === "pause") {
            tx.update(scheduleRef, {
              paused: true,
              nextDue: FieldValue.delete(),
              nextDueAt: FieldValue.delete(),
              updatedAt: FieldValue.serverTimestamp(),
            });
            return [];
          }

          const timezone = zoneOrUtc(owner.get("timezone"));
          const today = dayIn(now, timezone);
          const repeat = schedule.repeat as ScheduleRepeat;
          const { days, next } = dueDays(repeat, schedule.nextDue ?? today, today);

          const entriesRef = ledgerRef.collection("entries");
          const fresh: string[] = [];
          for (const day of days) {
            const existing = await tx.get(entriesRef.doc(scheduleEntryId(scheduleRef.id, day)));
            if (!existing.exists) fresh.push(day);
          }

          const authorName = (owner.get("displayName") as string | undefined) ?? "";
          for (const day of fresh) {
            const stamp = FieldValue.serverTimestamp();
            tx.create(entriesRef.doc(scheduleEntryId(scheduleRef.id, day)), {
              amount: schedule.amount,
              currency: schedule.currency,
              categoryId: schedule.categoryId,
              date: day,
              month: day.slice(0, 7),
              note: schedule.label,
              author: ownerRef,
              authorUid: schedule.ownerUid,
              authorName,
              scheduleId: scheduleRef.id,
              createdAt: stamp,
              updatedAt: stamp,
            });
          }
          tx.update(scheduleRef, {
            nextDue: next,
            nextDueAt: Timestamp.fromMillis(dueInstant(next, timezone)),
            ...(days.length ? { lastLogged: days[days.length - 1] } : {}),
          });

          if (!isNotificationEnabled(owner.data(), "scheduled_logged")) return [];
          const category = categories.find((c) => c.id === schedule.categoryId);
          const title = ledger.get("title");
          return fresh.map((day) => {
            const entryId = scheduleEntryId(scheduleRef.id, day);
            return {
              ownerDocId: schedule.ownerDocId,
              notification: {
                id: `scheduled_${ledgerRef.id}_${entryId}`,
                type: "scheduled_logged",
                groupId: ledgerRef.id,
                groupName: typeof title === "string" ? title : "",
                logKind: "ledger",
                entryId,
                label: schedule.label,
                amount: schedule.amount,
                currency: schedule.currency,
                date: day,
                month: day.slice(0, 7),
                ...(typeof category?.name === "string" ? { categoryName: category.name } : {}),
              },
            };
          });
        });

        entries += logged.length;
        for (const { ownerDocId, notification } of logged) {
          const { id, ...data } = notification;
          await db
            .collection("users")
            .doc(ownerDocId)
            .collection("notifications")
            .doc(id)
            .set({ ...data, createdAt: FieldValue.serverTimestamp(), readAt: null });
        }
      } catch (err) {
        reportError(err, {
          action: "log_scheduled_entry",
          extra: { ledgerId: ledgerRef.id, scheduleId: scheduleRef.id },
        });
      }
    }
    console.log(`logScheduledEntries: ${due.size} due, ${entries} notified`);
  }),
);
