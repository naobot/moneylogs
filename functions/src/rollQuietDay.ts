import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore } from "firebase-admin/firestore";
import { takeDailyChance } from "./knickknackFind";
import { parseQuietDayRequest } from "./knickknacks";
import { withSentryCall } from "./sentry";

/**
 * Deprecated: older clients called this on a quiet evening for the day's one roll. Rolls
 * now come from visits (dailyCheckIn), so this counts as one: the evening slot opens from
 * the evening whether or not anything was logged. Remove once no client calls it.
 */
export const rollQuietDay = onCall(
  withSentryCall("rollQuietDay", async (request) => {
    const uid = request.auth?.uid;
    if (!uid) throw new HttpsError("unauthenticated", "Sign in first.");
    if (!parseQuietDayRequest(request.data)) {
      throw new HttpsError("invalid-argument", "Expected { ledgerId }.");
    }

    const db = getFirestore();
    const users = await db.collection("users").where("userId", "==", uid).limit(1).get();
    if (users.empty) return { ok: true };
    await takeDailyChance({ db, userRef: users.docs[0].ref, kind: "visit" });
    return { ok: true };
  }),
);
