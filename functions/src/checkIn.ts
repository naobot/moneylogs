import { DocumentReference, Firestore, getFirestore } from "firebase-admin/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { coinsDue, nextStreak, parseCheckInRequest, StreakMarker } from "./coins";
import { dayIn } from "./knickknacks";
import { writeMilestone } from "./awardMilestone";

/**
 * Count a check-in on a financial log towards the person's streak, and hand over any coin
 * it earns (coins.ts). The streak lives at users/{id}/buddy/streak, which clients can't
 * read or write. Each coin comes with its achievement (awardMilestone.ts).
 */
export const recordCheckIn = async ({
  db,
  ledgerRef,
  userRef,
  loggedEntry,
  now = Date.now(),
}: {
  db: Firestore;
  ledgerRef: DocumentReference;
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
    for (const item of due) writeMilestone(tx, userRef, item, ledgerRef.id);
    return due;
  });

/**
 * The budget buddy calls this when a member opens a financial log (once a day per
 * browser). The server decides the day, so the client can't add days to a streak.
 */
export const checkInLedger = onCall(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError("unauthenticated", "Sign in first.");
  const req = parseCheckInRequest(request.data);
  if (!req) throw new HttpsError("invalid-argument", "Expected { ledgerId }.");

  const db = getFirestore();
  const ledgerRef = db.collection("ledgers").doc(req.ledgerId);
  const ledger = await ledgerRef.get();
  if (!ledger.exists || ledger.get("deleting") === true) return { ok: true };
  if (!((ledger.get("memberUids") ?? []) as string[]).includes(uid)) {
    throw new HttpsError("permission-denied", "Not a member of this log.");
  }

  const users = await db.collection("users").where("userId", "==", uid).limit(1).get();
  if (users.empty) return { ok: true };

  await recordCheckIn({ db, ledgerRef, userRef: users.docs[0].ref, loggedEntry: false });
  // Like other finds, a coin is revealed through the live finds query, not returned here.
  return { ok: true };
});
