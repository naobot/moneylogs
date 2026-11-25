/**
 * Which accounts the daily cleanup lists for an admin to remove (accountCleanup.ts). Nothing
 * is deleted automatically: an admin reviews the list in /admin and deletes each one by
 * hand. Two kinds, both idle for INACTIVE_DAYS:
 *
 * - guests (anonymous sign-ins that never saved their account): nobody can get back
 *   into one once its browser forgets it, so an idle one is already lost;
 * - accounts whose email was never confirmed (made-up addresses, mostly), but only with
 *   no ties to anyone: no friendships, requests included, and no log shared with others.
 *   Grandfathered accounts count too: the cutoff only decides who may reach out.
 *
 * Admins are never listed. Deletion runs the app's own cascade (deleteUserData).
 */

export const INACTIVE_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;

export type CleanupReason = "idle_guest" | "idle_unconfirmed";

export type CleanupAccount = {
  guest: boolean;
  emailVerified: boolean;
  admin: boolean;
  /** Auth metadata, as Firebase gives it (HTTP date strings). */
  creationTime?: string | null;
  lastSignInTime?: string | null;
  /** Last time the app refreshed a token: the best "still using it" signal. */
  lastRefreshTime?: string | null;
};

const ms = (time?: string | null) => {
  const parsed = time ? Date.parse(time) : NaN;
  return Number.isFinite(parsed) ? parsed : 0;
};

/** The latest sign of life: creation, sign-in or token refresh. 0 if none is known. */
export const lastActiveMs = (a: CleanupAccount): number =>
  Math.max(ms(a.creationTime), ms(a.lastSignInTime), ms(a.lastRefreshTime));

/**
 * The reason an account is listed for cleanup, judging by its auth record alone. An
 * `idle_unconfirmed` one still needs its ties checked (hasTies) before it goes.
 */
export const cleanupReason = (a: CleanupAccount, nowMs: number): CleanupReason | null => {
  if (a.admin) return null;
  const last = lastActiveMs(a);
  // Nothing known about when it was used: leave it alone rather than guess.
  if (!last || nowMs - last < INACTIVE_DAYS * DAY_MS) return null;
  if (a.guest) return "idle_guest";
  if (!a.emailVerified) return "idle_unconfirmed";
  return null;
};

export type Ties = { friendships: number; sharedLogs: number };

/** Anyone connected to this account: then it's kept, confirmed or not. */
export const hasTies = (t: Ties): boolean => t.friendships > 0 || t.sharedLogs > 0;
