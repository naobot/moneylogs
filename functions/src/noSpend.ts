import { DocumentReference, FieldValue, Firestore, getFirestore } from "firebase-admin/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { callerUserRef } from "./checkIn";
import { dayIn } from "./knickknacks";
import { refreshLuckTier } from "./knickknackFind";
import { applyNoSpend, LuckState, undoNoSpend } from "./luck";
import { withSentryCall } from "./sentry";

/**
 * No-spend days. A day with nothing logged could be a day someone forgot, so a day only
 * counts when the person says so ("nothing spent today" on a financial log). Confirmed days
 * live at users/{id}/noSpendDays/{YYYY-MM-DD}, which the owner can read and only the server
 * writes. A confirmed day gives luck a small hidden lift (luck.ts applyNoSpend); logging an
 * entry dated that day later takes the day back, lift and all.
 */

export const ALREADY_LOGGED = "You've logged something today already.";

/** Whether `uid` wrote any entry dated `day`, in any financial log they're in. */
const loggedOn = async (db: Firestore, uid: string, day: string): Promise<boolean> => {
  const ledgers = (
    await db.collection("ledgers").where("memberUids", "array-contains", uid).get()
  ).docs.filter((l) => l.get("deleting") !== true);
  const hits = await Promise.all(
    ledgers.map((l) =>
      l.ref
        .collection("entries")
        .where("authorUid", "==", uid)
        .where("date", "==", day)
        .limit(1)
        .get(),
    ),
  );
  return hits.some((q) => !q.empty);
};

/**
 * Confirm today, in the caller's timezone, as a no-spend day. Refused if they've logged
 * anything dated today; confirming twice is harmless.
 */
export const confirmNoSpendDayFor = async ({
  db,
  uid,
  now = Date.now(),
}: {
  db: Firestore;
  uid: string;
  now?: number;
}): Promise<{ ok: true }> => {
  const userRef = await callerUserRef(db, uid);
  if (!userRef) throw new HttpsError("failed-precondition", "No user profile.");
  const user = await userRef.get();
  const today = dayIn(now, user.get("timezone") as string | undefined);
  if (await loggedOn(db, uid, today)) throw new HttpsError("failed-precondition", ALREADY_LOGGED);

  const dayRef = userRef.collection("noSpendDays").doc(today);
  const luckRef = userRef.collection("buddy").doc("luck");
  const momentum = await db.runTransaction(async (tx) => {
    const [daySnap, luckSnap] = await Promise.all([tx.get(dayRef), tx.get(luckRef)]);
    if (daySnap.exists) return null;
    const { next, rewarded } = applyNoSpend({
      state: luckSnap.data() as LuckState | undefined,
      today,
    });
    tx.create(dayRef, { confirmedAt: FieldValue.serverTimestamp(), rewarded });
    if (next) tx.set(luckRef, next);
    return next?.momentum ?? null;
  });
  if (momentum !== null) await refreshLuckTier({ db, userRef, uid, today, now, momentum });
  return { ok: true };
};

export const confirmNoSpendDay = onCall(
  withSentryCall("confirmNoSpendDay", async (request) => {
    const uid = request.auth?.uid;
    if (!uid) throw new HttpsError("unauthenticated", "Sign in first.");
    return confirmNoSpendDayFor({ db: getFirestore(), uid });
  }),
);

/**
 * An entry turned up dated `day`: if the author had confirmed it as a no-spend day, it no
 * longer is, and its luck lift comes back off. Quietly, with no message.
 */
export const voidNoSpendDay = async ({
  db,
  userRef,
  day,
  now = Date.now(),
}: {
  db: Firestore;
  userRef: DocumentReference;
  day: string;
  now?: number;
}): Promise<void> => {
  const dayRef = userRef.collection("noSpendDays").doc(day);
  const luckRef = userRef.collection("buddy").doc("luck");
  const momentum = await db.runTransaction(async (tx) => {
    const [daySnap, luckSnap] = await Promise.all([tx.get(dayRef), tx.get(luckRef)]);
    if (!daySnap.exists) return null;
    tx.delete(dayRef);
    const next = undoNoSpend({ state: luckSnap.data() as LuckState | undefined, day });
    if (next) tx.set(luckRef, next);
    return next?.momentum ?? null;
  });
  if (momentum === null) return;
  const user = await userRef.get();
  const uid = user.get("userId") as string | undefined;
  if (!uid) return;
  const today = dayIn(now, user.get("timezone") as string | undefined);
  await refreshLuckTier({ db, userRef, uid, today, now, momentum });
};
