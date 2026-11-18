import { DocumentReference, Firestore, getFirestore } from "firebase-admin/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { coinsDue, nextStreak, parseCheckInRequest, StreakMarker } from "./coins";
import { dayIn } from "./knickknacks";
import { takeDailyChance } from "./knickknackFind";
import { writeMilestone } from "./awardMilestone";
import { withSentryCall } from "./sentry";

/**
 * Count a check-in towards the person's streak, and hand over any coin it earns (coins.ts).
 * A check-in is any signed-in visit (dailyCheckIn) or a logged entry. The streak lives at
 * users/{id}/buddy/streak, which clients can't read or write. Each coin comes with its
 * achievement (awardMilestone.ts); a coin from a logged entry remembers its log.
 */
export const recordCheckIn = async ({
  db,
  ledgerRef,
  userRef,
  loggedEntry,
  now = Date.now(),
}: {
  db: Firestore;
  ledgerRef?: DocumentReference | null;
  userRef: DocumentReference;
  loggedEntry: boolean;
  now?: number;
}): Promise<string[]> =>
  db.runTransaction(async (tx) => {
    const markerRef = userRef.collection("buddy").doc("streak");
    const [user, markerSnap] = await Promise.all([tx.get(userRef), tx.get(markerRef)]);
    if (!user.exists) return [];

    const marker = markerSnap.data() as StreakMarker | undefined;
    const today = dayIn(now, user.get("timezone") as string | undefined);
    const next = nextStreak(marker, today);
    const given = marker?.coins ?? [];
    const due = coinsDue({ days: next?.days ?? marker?.days ?? 0, given, loggedEntry });
    if (!next && !due.length) return [];

    tx.set(markerRef, { ...next, coins: [...given, ...due] }, { merge: true });
    for (const item of due) writeMilestone(tx, user, item, ledgerRef?.id ?? null);
    return due;
  });

/** The signed-in caller's user doc, or null if they don't have one yet. */
export const callerUserRef = async (db: Firestore, uid: string) => {
  const users = await db.collection("users").where("userId", "==", uid).limit(1).get();
  return users.empty ? null : users.docs[0].ref;
};

/**
 * A signed-in visit: today's check-in (streak, coins, luck), and the day's visit roll for a
 * knick-knack, or the evening one once that's spent. The server decides the day and the
 * hour from the stored timezone, so the client can't add days or rolls. `more` tells the
 * client whether a visit later today could still roll, so it knows to ask again.
 */
const checkInVisit = async (uid: string): Promise<{ ok: true; more: boolean }> => {
  const db = getFirestore();
  const userRef = await callerUserRef(db, uid);
  if (!userRef) return { ok: true, more: false };
  await recordCheckIn({ db, userRef, loggedEntry: false });
  // Like other finds, what turns up is revealed through the live finds query, not here.
  const { more } = await takeDailyChance({ db, userRef, kind: "visit" });
  return { ok: true, more };
};

export const dailyCheckIn = onCall(
  withSentryCall("dailyCheckIn", async (request) => {
    const uid = request.auth?.uid;
    if (!uid) throw new HttpsError("unauthenticated", "Sign in first.");
    return checkInVisit(uid);
  }),
);

/**
 * Deprecated: older clients call this when opening a financial log. It now counts as a
 * visit, like dailyCheckIn. Remove once no client in the wild calls it.
 */
export const checkInLedger = onCall(
  withSentryCall("checkInLedger", async (request) => {
    const uid = request.auth?.uid;
    if (!uid) throw new HttpsError("unauthenticated", "Sign in first.");
    if (!parseCheckInRequest(request.data)) {
      throw new HttpsError("invalid-argument", "Expected { ledgerId }.");
    }
    return checkInVisit(uid);
  }),
);
