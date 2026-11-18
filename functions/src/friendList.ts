/**
 * Public friends lists. friendships/{pairId} is readable only by the pair, so what other
 * people see on a profile is a server-written mirror, friendLists/{userDocId}, built from
 * the person's accepted friendships. Two user-doc switches shape it:
 *
 * - `showFriends` (opt-in): the owner shows their list. Off or unset, there is no
 *   friendLists doc at all, so the list can't be read.
 * - `hideFromFriendLists` (opt-out): leave me off everyone else's public list. Unset,
 *   you appear.
 *
 * Pure helpers here so root Vitest can test them without the SDK; the triggers live in
 * mirrorFriendList.ts.
 */

type TimestampLike = { toMillis: () => number };

export type FriendPairData = {
  users?: unknown;
  status?: unknown;
  acceptedAt?: unknown;
};

type UserFields = Record<string, unknown> | undefined;

export const showsFriendList = (user: UserFields): boolean => user?.showFriends === true;

export const hiddenFromFriendLists = (user: UserFields): boolean =>
  user?.hideFromFriendLists === true;

const millis = (value: unknown): number =>
  value && typeof (value as TimestampLike).toMillis === "function"
    ? (value as TimestampLike).toMillis()
    : 0;

/** The other person in each accepted pair, longest-standing friends first. */
export const acceptedFriendIds = (pairs: ReadonlyArray<FriendPairData>, me: string): string[] =>
  pairs
    .filter((p) => p.status === "accepted" && Array.isArray(p.users) && p.users.includes(me))
    .map((p) => ({
      id: (p.users as string[]).find((u) => u !== me),
      at: millis(p.acceptedAt),
    }))
    .filter((f): f is { id: string; at: number } => typeof f.id === "string")
    .sort((a, b) => a.at - b.at)
    .map((f) => f.id);

/** True when a write to a pair started or ended a friendship (pending changes nothing). */
export const friendshipFlipped = (
  before: FriendPairData | undefined,
  after: FriendPairData | undefined,
) => (before?.status === "accepted") !== (after?.status === "accepted");

/** Both people in a pair, from whichever side of the write still has it. */
export const pairUsers = (
  before: FriendPairData | undefined,
  after: FriendPairData | undefined,
) => {
  const users = (after?.users ?? before?.users) as unknown;
  return Array.isArray(users) ? users.filter((u): u is string => typeof u === "string") : [];
};

export const sameIds = (a: ReadonlyArray<string>, b: ReadonlyArray<string>) =>
  a.length === b.length && a.every((id, i) => id === b[i]);
