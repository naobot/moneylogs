import { HttpsError, type CallableRequest } from "firebase-functions/v2/https";
import { getAuth } from "firebase-admin/auth";
import { EMAIL_UNCONFIRMED, isEmailConfirmed } from "./confirmEmailPlan";

/**
 * Throws unless the caller has confirmed their email (or is grandfathered, see
 * confirmEmailPlan.ts). A token that already says verified is enough; otherwise the auth
 * record decides, since a token minted before the link was clicked still says false.
 */
export const requireConfirmedEmail = async (auth: CallableRequest["auth"]): Promise<void> => {
  if (!auth?.uid) throw new HttpsError("unauthenticated", "Sign in first.");
  if (auth.token.email_verified === true) return;
  const account = await getAuth().getUser(auth.uid);
  if (
    isEmailConfirmed({
      emailVerified: account.emailVerified,
      creationTime: account.metadata.creationTime,
    })
  )
    return;
  throw new HttpsError("failed-precondition", "Confirm your email address first.", {
    reason: EMAIL_UNCONFIRMED,
  });
};
