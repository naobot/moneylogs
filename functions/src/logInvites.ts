import { onCall, HttpsError } from "firebase-functions/v2/https";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { callerUserDoc, inbox } from "./friends";
import { pairId } from "./friendsPlan";
import { absoluteEndMs, TimelineGroup } from "./logTimeline";
import {
  logInviteNotificationId,
  memberIdsOf,
  parseInviteRequest,
  planInvites,
} from "./logInvitesPlan";
import { isNotificationEnabled } from "./notificationPrefs";
import { withSentryCall } from "./sentry";

/**
 * Invite friends into a log you're in: each one gets a `log_invite` notification that
 * links to the log's join page. Only accepted friends who aren't members yet are invited,
 * and only while the log has room (and, for a social log, hasn't ended). Inviting someone
 * again replaces their earlier invite to the same log. See logInvitesPlan.ts.
 */
export const inviteFriendsToLog = onCall(
  withSentryCall("inviteFriendsToLog", async (request) => {
    const uid = request.auth?.uid;
    if (!uid) throw new HttpsError("unauthenticated", "Sign in first.");
    const req = parseInviteRequest(request.data);
    if (!req) {
      throw new HttpsError("invalid-argument", "Expected { logId, logKind, friendIds }.");
    }
    const db = getFirestore();
    const me = await callerUserDoc(db, uid);

    const log = await db
      .collection(req.logKind === "ledger" ? "ledgers" : "log_groups")
      .doc(req.logId)
      .get();
    if (!log.exists) throw new HttpsError("not-found", "No such log.");
    const memberIds = memberIdsOf(log.get("members"));
    if (!memberIds.includes(me.id)) {
      throw new HttpsError("permission-denied", "Only members can invite people.");
    }
    const max = log.get("max_participants");
    if (typeof max === "number" && memberIds.length >= max) {
      throw new HttpsError("failed-precondition", "This log is full.");
    }
    if (req.logKind === "social") {
      const end = log.get("end") as { toMillis?: () => number } | undefined;
      const group: TimelineGroup = {
        id: log.id,
        title: (log.get("title") as string | undefined) ?? "",
        endWallClock: log.get("endWallClock") as string | undefined,
        endMs: end?.toMillis?.() ?? Infinity,
      };
      if (absoluteEndMs(group) < Date.now()) {
        throw new HttpsError("failed-precondition", "This log has ended.");
      }
    }

    const pairs = await db.getAll(
      ...req.friendIds.map((id) => db.collection("friendships").doc(pairId(me.id, id))),
    );
    const acceptedFriendIds = new Set(
      pairs
        .filter((p) => p.exists && p.get("status") === "accepted")
        .map((p) => (p.get("users") as string[]).find((id) => id !== me.id))
        .filter((id): id is string => !!id),
    );
    const plan = planInvites({
      inviterId: me.id,
      friendIds: req.friendIds,
      memberIds,
      acceptedFriendIds,
    });

    const friends = plan.invite.length
      ? await db.getAll(...plan.invite.map((id) => db.collection("users").doc(id)))
      : [];
    const batch = db.batch();
    for (const friend of friends) {
      // Switched off: still counts as invited, so the inviter isn't told otherwise.
      if (!friend.exists || !isNotificationEnabled(friend.data(), "log_invite")) continue;
      batch.set(inbox(db, friend.id).doc(logInviteNotificationId(req.logId)), {
        type: "log_invite",
        logKind: req.logKind,
        groupId: req.logId,
        groupName: (log.get("title") as string | undefined) ?? "",
        actorId: me.id,
        actorName: (me.get("displayName") as string | undefined) ?? "someone",
        createdAt: FieldValue.serverTimestamp(),
        readAt: null,
      });
    }
    await batch.commit();

    return { invited: plan.invite, skipped: plan.skipped };
  }),
);
