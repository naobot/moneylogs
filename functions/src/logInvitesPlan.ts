/**
 * Pure rules for inviting friends into a log (inviteFriendsToLog in logInvites.ts), kept
 * free of the SDK so root Vitest can test them.
 *
 * An invite is a `log_invite` notification in the friend's inbox that links to the log's
 * existing join page (/g/{id}/invite or /l/{id}/invite). It grants nothing by itself:
 * joining still goes through that page, the same as following a shared invite link.
 */

export type LogKind = "social" | "ledger";

/** At most this many friends per call: a log never holds more people than this. */
export const MAX_INVITES_PER_CALL = 30;

const DOC_ID = /^[A-Za-z0-9_-]{1,128}$/;

export type InviteRequest = { logId: string; logKind: LogKind; friendIds: string[] };

/** `{ logId, logKind, friendIds }`, de-duplicated, or null if malformed. */
export const parseInviteRequest = (data: unknown): InviteRequest | null => {
  if (!data || typeof data !== "object") return null;
  const { logId, logKind, friendIds } = data as Record<string, unknown>;
  if (typeof logId !== "string" || !DOC_ID.test(logId)) return null;
  if (logKind !== "social" && logKind !== "ledger") return null;
  if (!Array.isArray(friendIds) || friendIds.length === 0) return null;
  if (!friendIds.every((id): id is string => typeof id === "string" && DOC_ID.test(id))) {
    return null;
  }
  const unique = [...new Set(friendIds)];
  if (unique.length > MAX_INVITES_PER_CALL) return null;
  return { logId, logKind, friendIds: unique };
};

/** Why a friend didn't get an invite. */
export type SkipReason = "self" | "not_friends" | "member";

export type InvitePlan = {
  invite: string[];
  skipped: Array<{ id: string; reason: SkipReason }>;
};

/**
 * Who gets an invite: accepted friends of the inviter who aren't in the log yet. Room in
 * the log isn't checked here: the join page already turns people away from a full log,
 * and a spot may open up before they get to it.
 */
export const planInvites = (args: {
  inviterId: string;
  friendIds: ReadonlyArray<string>;
  memberIds: ReadonlyArray<string>;
  /** Friend ids whose friendship with the inviter is accepted. */
  acceptedFriendIds: ReadonlySet<string>;
}): InvitePlan => {
  const members = new Set(args.memberIds);
  const plan: InvitePlan = { invite: [], skipped: [] };
  for (const id of args.friendIds) {
    if (id === args.inviterId) plan.skipped.push({ id, reason: "self" });
    else if (members.has(id)) plan.skipped.push({ id, reason: "member" });
    else if (!args.acceptedFriendIds.has(id)) plan.skipped.push({ id, reason: "not_friends" });
    else plan.invite.push(id);
  }
  return plan;
};

/**
 * One invite per log in each inbox: inviting again (by anyone) replaces it as unread
 * rather than piling up, and joining can clear it by id.
 */
export const logInviteNotificationId = (logId: string) => `log_invite_${logId}`;

/** Doc ids out of a log's `members` array of user doc references. */
export const memberIdsOf = (members: unknown): string[] =>
  Array.isArray(members)
    ? members
        .map((m) => (m && typeof m === "object" ? (m as { id?: unknown }).id : undefined))
        .filter((id): id is string => typeof id === "string" && id.length > 0)
    : [];
