import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore } from "firebase-admin/firestore";
import { BudgetCategory } from "./ledgerBudget";
import { maybeFindKnickKnack } from "./knickknackFind";
import { hourIn, parseQuietDayRequest, QUIET_DAY_FROM_HOUR } from "./knickknacks";

/**
 * The budget buddy's evening check-in calls this, so a day with nothing logged still
 * gets its one roll for a knick-knack. It's the same daily roll that logging an entry
 * uses: if the caller already logged today, the day's roll is spent and this does
 * nothing, so it can't be used to farm finds. Only from the evening, in the caller's
 * own timezone, and only for a member of the log.
 */
export const rollQuietDay = onCall(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError("unauthenticated", "Sign in first.");
  const req = parseQuietDayRequest(request.data);
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

  await maybeFindKnickKnack({
    db,
    ledgerRef,
    authorRef: users.docs[0].ref,
    categories: (ledger.get("categories") ?? []) as BudgetCategory[],
    onlyIf: async ({ timezone }) => hourIn(Date.now(), timezone) >= QUIET_DAY_FROM_HOUR,
  });
  // What (if anything) was found isn't returned: the buddy reveals it through the live
  // finds query, the same way as a find from logging.
  return { ok: true };
});
