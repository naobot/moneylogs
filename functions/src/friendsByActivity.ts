import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { withSentryCall } from "./sentry";

/** One accepted friend: their user doc id and auth uid. */
export type FriendRef = { userDocId: string; uid: string };

/** The friend in an accepted friendship doc, from the side of `uid`; null otherwise. */
export const friendIn = (
  data: { users?: unknown; uids?: unknown; status?: unknown },
  uid: string,
): FriendRef | null => {
  const { users, uids, status } = data;
  if (status !== "accepted" || !Array.isArray(users) || !Array.isArray(uids)) return null;
  const mine = uids.indexOf(uid);
  if (mine === -1 || users.length !== 2 || uids.length !== 2) return null;
  const other = 1 - mine;
  return typeof users[other] === "string" && typeof uids[other] === "string"
    ? { userDocId: users[other], uid: uids[other] }
    : null;
};

/**
 * When someone last used the app: the later of their last sign-in and their last token
 * refresh (a signed-in session refreshes about hourly while it's open). 0 if unknown.
 */
export const lastSeenOf = (metadata: {
  lastSignInTime?: string | null;
  lastRefreshTime?: string | null;
}): number =>
  Math.max(
    0,
    ...[metadata.lastSignInTime, metadata.lastRefreshTime].map((t) => {
      const ms = t ? Date.parse(t) : NaN;
      return Number.isFinite(ms) ? ms : 0;
    }),
  );

/** Most recently seen first; ties and the never-seen keep their given order. */
export const orderByLastSeen = (
  friends: ReadonlyArray<FriendRef>,
  seen: ReadonlyMap<string, number>,
): string[] =>
  friends
    .map((f, i) => ({ id: f.userDocId, i, t: seen.get(f.uid) ?? 0 }))
    .sort((a, b) => b.t - a.t || a.i - b.i)
    .map((f) => f.id);

const AUTH_BATCH = 100; // getUsers takes at most 100 identifiers

/**
 * The caller's friends, most recently signed in first. Only the order leaves the server:
 * no times, so nobody can read when a friend was last around, just who was more recent.
 */
export const friendsByActivity = onCall(
  withSentryCall("friendsByActivity", async (request) => {
    const uid = request.auth?.uid;
    if (!uid) throw new HttpsError("unauthenticated", "Sign in first.");

    const snap = await getFirestore()
      .collection("friendships")
      .where("uids", "array-contains", uid)
      .get();
    const friends = snap.docs
      .map((d) => friendIn(d.data(), uid))
      .filter((f): f is FriendRef => !!f)
      // A stable base order, so ties don't shuffle between loads.
      .sort((a, b) => a.userDocId.localeCompare(b.userDocId));

    const seen = new Map<string, number>();
    for (let i = 0; i < friends.length; i += AUTH_BATCH) {
      const batch = friends.slice(i, i + AUTH_BATCH).map((f) => ({ uid: f.uid }));
      const { users } = await getAuth().getUsers(batch);
      for (const u of users) seen.set(u.uid, lastSeenOf(u.metadata));
    }

    return { friends: orderByLastSeen(friends, seen) };
  }),
);
