import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { planNewUserDoc } from "./ensureUserDocPlan";
import { reportError, withSentryCall } from "./sentry";

/**
 * Give a signed-in account its user doc if it has none (see ensureUserDocPlan.ts for how
 * that happens). The lookup and the create share a transaction, so two tabs healing the
 * same account at once still make only one doc. Returns the user doc id either way.
 */
export const ensureUserDoc = onCall(
  withSentryCall("ensureUserDoc", async (request) => {
    const uid = request.auth?.uid;
    if (!uid) throw new HttpsError("unauthenticated", "Sign in first.");
    const token = request.auth!.token;

    const db = getFirestore();
    const users = db.collection("users");
    const result = await db.runTransaction(async (tx) => {
      const found = await tx.get(users.where("userId", "==", uid).limit(1));
      if (!found.empty) return { id: found.docs[0].id, created: false };
      const ref = users.doc();
      tx.create(ref, {
        ...planNewUserDoc(uid, token),
        createdAt: FieldValue.serverTimestamp(),
      });
      return { id: ref.id, created: true };
    });

    if (result.created) {
      // Worth knowing how often registration leaves an account half-made.
      reportError(new Error("Signed-in account had no user doc; created one"), {
        action: "ensure_user_doc",
        level: "warning",
        extra: { provider: token.firebase?.sign_in_provider },
      });
    }
    return result;
  }),
);
