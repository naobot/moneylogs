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
  // A guest is never confirmed, however old the account: the cutoff only grandfathers
  // real sign-ups. (The app answers this reason with "save your account" for guests.)
  const anonymous = auth.token.firebase?.sign_in_provider === "anonymous";
  if (!anonymous && auth.token.email_verified === true) return;
  const account = anonymous ? null : await getAuth().getUser(auth.uid);
  if (
    account &&
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

/**
 * Throws for a guest (an anonymous sign-in, src/features/auth/guest.ts): what they'd
 * accept or join would outlive them, so saving the account comes first.
 */
export const rejectGuests = (auth: CallableRequest["auth"]): void => {
  if (!auth?.uid) throw new HttpsError("unauthenticated", "Sign in first.");
  if (auth.token.firebase?.sign_in_provider === "anonymous") {
    throw new HttpsError("failed-precondition", "Save your account first.", { reason: "guest" });
  }
};
