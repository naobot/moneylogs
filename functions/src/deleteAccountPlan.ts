/**
 * Pure helpers for the deleteAccount callable. Dependency-free so they can be unit tested
 * from the root Vitest run.
 *
 * Policy: logs the person is alone in are deleted outright. Logs shared with others stay
 * for the remaining members: the person is removed from them, creatorship passes to the
 * next member, and their content stays but is anonymised (author name replaced, reactions
 * and comment subscriptions removed).
 */

/** Shown in place of a deleted account's name on content it leaves behind. */
export const DELETED_USER_NAME = "deleted user";

/** How recently the caller must have signed in (Firebase's own sensitive-op window). */
export const RECENT_SIGN_IN_SECONDS = 5 * 60;

/** Whether an ID token's `auth_time` (seconds) is recent enough to delete the account. */
export const isRecentSignIn = (
  authTime: unknown,
  nowSeconds: number,
  windowSeconds = RECENT_SIGN_IN_SECONDS,
): boolean =>
  typeof authTime === "number" &&
  authTime <= nowSeconds + 60 &&
  nowSeconds - authTime <= windowSeconds;

type Ref = { id?: unknown } | null | undefined;

const refIdOf = (ref: Ref): string | undefined =>
  ref && typeof ref.id === "string" && ref.id ? ref.id : undefined;

export type SocialExitPlan =
  | { action: "purge" }
  | { action: "leave"; remainingMemberIds: string[]; transferCreator: boolean }
  | { action: "skip" };

/**
 * What to do with a social log group when its member deletes their account.
 * - The person is its only member (or its creator with nobody left): delete it.
 * - Others remain: leave it; if the person created it, the first remaining member
 *   becomes the creator so someone can still manage it.
 * - The person isn't involved (e.g. a stale `groups` entry on an empty log): skip.
 */
export const planSocialExit = (
  data: { members?: ReadonlyArray<Ref>; createdBy?: unknown },
  uid: string,
  userDocIds: ReadonlySet<string>,
): SocialExitPlan => {
  const memberIds = (data.members ?? []).map(refIdOf).filter((id): id is string => !!id);
  const isMember = memberIds.some((id) => userDocIds.has(id));
  const isCreator = data.createdBy === uid;
  const remaining = [...new Set(memberIds.filter((id) => !userDocIds.has(id)))];

  if (remaining.length === 0)
    return isMember || isCreator ? { action: "purge" } : { action: "skip" };
  return { action: "leave", remainingMemberIds: remaining, transferCreator: isCreator };
};

export type LedgerExitPlan<R> =
  | { action: "purge" }
  | { action: "leave"; members: R[]; memberUids: string[]; createdBy?: string }
  | { action: "skip" };

/**
 * What to do with a financial ledger. `members` (user doc refs) and `memberUids` (auth
 * uids) are index-aligned, so both are filtered together. Creatorship passes to the next
 * member when it was recorded explicitly; otherwise `memberUids[0]` already implies it.
 */
export const planLedgerExit = <R extends Ref>(
  data: { members?: ReadonlyArray<R>; memberUids?: ReadonlyArray<unknown>; createdBy?: unknown },
  uid: string,
  userDocIds: ReadonlySet<string>,
): LedgerExitPlan<R> => {
  const members = data.members ?? [];
  const memberUids = data.memberUids ?? [];
  const length = Math.max(members.length, memberUids.length);
  const keptMembers: R[] = [];
  const keptUids: string[] = [];
  let involved = false;

  for (let i = 0; i < length; i++) {
    const memberUid = memberUids[i];
    const memberId = refIdOf(members[i]);
    if (memberUid === uid || (memberId && userDocIds.has(memberId))) {
      involved = true;
      continue;
    }
    if (typeof memberUid === "string" && members[i] !== undefined) {
      keptMembers.push(members[i]);
      keptUids.push(memberUid);
    }
  }

  if (!involved) return { action: "skip" };
  if (keptUids.length === 0) return { action: "purge" };
  return {
    action: "leave",
    members: keptMembers,
    memberUids: keptUids,
    ...(data.createdBy === uid ? { createdBy: keptUids[0] } : {}),
  };
};

export type PostCleanup = {
  /** `reactions.<key>` entries to delete (the person's reactions). */
  reactionKeys: string[];
  /** Whether the person is in `commentSubscribers`. */
  unsubscribe: boolean;
  /** Whether the person wrote the post, so its author name must be anonymised. */
  isAuthor: boolean;
};

/** What to change on a post in a log that stays, or null when it doesn't involve them. */
export const planPostCleanup = (
  post: {
    author?: Ref;
    reactions?: Record<string, unknown> | null;
    commentSubscribers?: ReadonlyArray<Ref>;
    authorName?: unknown;
  },
  userDocIds: ReadonlySet<string>,
): PostCleanup | null => {
  const reactionKeys = Object.keys(post.reactions ?? {}).filter((key) => userDocIds.has(key));
  const unsubscribe = (post.commentSubscribers ?? []).some((ref) => {
    const id = refIdOf(ref);
    return !!id && userDocIds.has(id);
  });
  const authorId = refIdOf(post.author);
  const isAuthor = !!authorId && userDocIds.has(authorId);
  const needsAuthorChange = isAuthor && post.authorName !== DELETED_USER_NAME;
  if (!reactionKeys.length && !unsubscribe && !needsAuthorChange) return null;
  return { reactionKeys, unsubscribe, isAuthor: needsAuthorChange };
};
