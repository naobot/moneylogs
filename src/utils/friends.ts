/**
 * Friendships live at `friendships/{pairId}`, one doc per pair of users (by user doc
 * id), written only by the friend callables (functions/src/friends.ts). Mirrored in
 * functions/src/friendsPlan.ts; a root test keeps the two in step.
 */

export type FriendshipStatus = "pending" | "accepted";

export type Friendship = {
  id: string;
  /** The two user doc ids, sorted. */
  users: [string, string];
  /** Their auth uids, in the same order (what the read rule checks). */
  uids: [string, string];
  /** Who sent the request. */
  requester: string;
  status: FriendshipStatus;
};

/** Where you stand with someone: nothing yet, you asked, they asked, or friends. */
export type FriendState = "none" | "outgoing" | "incoming" | "friends";

/** The friendship doc id for two users, the same whichever way round. */
export const pairId = (a: string, b: string): string => [a, b].sort().join("__");

export const friendState = (
  friendship: Pick<Friendship, "requester" | "status"> | null | undefined,
  me: string,
): FriendState => {
  if (!friendship) return "none";
  if (friendship.status === "accepted") return "friends";
  return friendship.requester === me ? "outgoing" : "incoming";
};

/** The other person in a friendship. */
export const otherUser = (friendship: Pick<Friendship, "users">, me: string): string =>
  friendship.users[0] === me ? friendship.users[1] : friendship.users[0];
