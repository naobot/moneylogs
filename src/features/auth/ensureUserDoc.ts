import { httpsCallable } from "firebase/functions";
import { functions } from "@/config/firebase-config";

/**
 * A signed-in account can end up without a user doc: registration creates the Auth
 * account first and the doc second, and if the second step never lands (the app closed,
 * the network dropped), trying again only says the email is taken. Without the doc,
 * nothing works (no welcome wizard, Home can't load, nothing saves), so the app asks the
 * server to make it (functions/src/ensureUserDoc.ts). The server checks and creates in
 * one transaction, so asking when a doc does exist is harmless.
 */
export const ensureUserDoc = () =>
  httpsCallable<void, { id: string; created: boolean }>(functions, "ensureUserDoc")();

/**
 * Registration's own write gets this long to land before the app steps in, so the two
 * don't race to make a doc each.
 */
export const USER_DOC_GRACE_MS = 30_000;

/**
 * How long to wait before asking the server for a missing user doc: none once the account
 * is past the grace period, else the rest of it. An unknown creation time waits it all.
 */
export const missingUserDocDelay = (creationTime: string | undefined, now: number): number => {
  const created = creationTime ? Date.parse(creationTime) : NaN;
  if (Number.isNaN(created)) return USER_DOC_GRACE_MS;
  return Math.max(0, created + USER_DOC_GRACE_MS - now);
};
