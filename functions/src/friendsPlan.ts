/**
 * Pure rules for the friend callables, kept free of the SDK so root Vitest can test
 * them. Mirrors src/utils/friends.ts (pairId, friendState).
 */

export type FriendState = "none" | "outgoing" | "incoming" | "friends";

export const pairId = (a: string, b: string): string => [a, b].sort().join("__");

export const friendState = (
  friendship: { requester?: unknown; status?: unknown } | undefined,
  me: string,
): FriendState => {
  if (!friendship) return "none";
  if (friendship.status === "accepted") return "friends";
  return friendship.requester === me ? "outgoing" : "incoming";
};

const DOC_ID = /^[A-Za-z0-9_-]{1,128}$/;

/** `{ otherUserDocId }` (plus `accept` for responses), or null if malformed. */
export const parseFriendRequest = (
  data: unknown,
): { otherUserDocId: string; accept?: boolean } | null => {
  if (!data || typeof data !== "object") return null;
  const { otherUserDocId, accept } = data as Record<string, unknown>;
  if (typeof otherUserDocId !== "string" || !DOC_ID.test(otherUserDocId)) return null;
  if (accept !== undefined && typeof accept !== "boolean") return null;
  return accept === undefined ? { otherUserDocId } : { otherUserDocId, accept };
};

/** What a call does to the friendship from where things stand. */
export type FriendAction = "create" | "accept" | "delete" | "noop";

/** Asking someone: starts a request, or accepts theirs if they already asked. */
export const planRequest = (state: FriendState): FriendAction =>
  state === "none" ? "create" : state === "incoming" ? "accept" : "noop";

/** Answering a request: only an incoming one can be answered. */
export const planRespond = (state: FriendState, accept: boolean): FriendAction | "invalid" =>
  state !== "incoming" ? "invalid" : accept ? "accept" : "delete";

/** Cancelling a request, declining one, or unfriending: all just remove the pair. */
export const planRemove = (state: FriendState): FriendAction =>
  state === "none" ? "noop" : "delete";

/** Deterministic inbox ids, so a repeat request replaces rather than duplicates. */
export const friendRequestNotificationId = (fromUserDocId: string) =>
  `friend_request_${fromUserDocId}`;
export const friendAcceptedNotificationId = (fromUserDocId: string) =>
  `friend_accepted_${fromUserDocId}`;
