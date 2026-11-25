/**
 * Reaching out to other people (friend requests, invite links, gifts, inviting friends into
 * a log) needs a confirmed email; accounts created before the cutoff are grandfathered in.
 * The server decides (functions/src/confirmEmail.ts); this mirrors it so the app can ask
 * before trying. Kept in step with functions/src/confirmEmailPlan.ts.
 */

/** The start of 23 Nov 2026, Pacific time: accounts made before this are grandfathered. */
export const CONFIRM_EMAIL_CUTOFF_MS = Date.parse("2026-11-23T00:00:00-08:00");

/** The reason a callable gives when it turns someone away for this. */
export const EMAIL_UNCONFIRMED = "email_unconfirmed";

/** `creationTime` is the auth user's metadata.creationTime (an HTTP date string). */
export const isEmailConfirmed = (account: {
  emailVerified?: boolean;
  creationTime?: string | null;
}): boolean => {
  if (account.emailVerified === true) return true;
  const created = account.creationTime ? Date.parse(account.creationTime) : NaN;
  return Number.isFinite(created) && created < CONFIRM_EMAIL_CUTOFF_MS;
};

/** A callable said no because the email isn't confirmed yet. */
export const isEmailUnconfirmedError = (err: unknown): boolean =>
  (err as { details?: { reason?: unknown } } | null)?.details?.reason === EMAIL_UNCONFIRMED;
