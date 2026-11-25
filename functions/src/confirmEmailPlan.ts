/**
 * Reaching out to other people (friend requests, invite links, gifts, inviting friends into
 * a log) needs a confirmed email, so a made-up address can't be used to contact real
 * people. Accounts created before the cutoff are grandfathered in.
 *
 * Kept in step with src/utils/confirmedEmail.ts (confirmEmailPlan.test.ts checks).
 */

/** The start of 23 Nov 2026, Pacific time: accounts made before this are grandfathered. */
export const CONFIRM_EMAIL_CUTOFF_MS = Date.parse("2026-11-23T00:00:00-08:00");

/** What the error carries, so the app can show "confirm your email" instead of a failure. */
export const EMAIL_UNCONFIRMED = "email_unconfirmed";

/** `creationTime` is the auth record's (an HTTP date string, as Firebase gives it). */
export const isEmailConfirmed = (account: {
  emailVerified?: boolean;
  creationTime?: string | null;
}): boolean => {
  if (account.emailVerified === true) return true;
  const created = account.creationTime ? Date.parse(account.creationTime) : NaN;
  return Number.isFinite(created) && created < CONFIRM_EMAIL_CUTOFF_MS;
};
