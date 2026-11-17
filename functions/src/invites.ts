import { onCall, HttpsError } from "firebase-functions/v2/https";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { friendState, pairId } from "./friendsPlan";
import { callerUserDoc, writeAccepted } from "./friends";
import { newInviteCode, parseInviteCode, parseReset, planInvite } from "./invitesPlan";
import { awardMilestoneOnce } from "./awardMilestone";
import { FIRST_FRIEND, FIRST_INVITE } from "./milestones";
import { reportError, withSentryCall } from "./sentry";

/**
 * Personal invite links (/invite/{code}). invites/{code} → { inviterId } is closed to
 * clients; the inviter's current code is also kept on their user doc (inviteCode) so it
 * can be handed back or replaced. See invitesPlan.ts for the rules.
 */

/** Your invite code, made on first ask. `{ reset: true }` retires the old link for a new one. */
export const getInviteCode = onCall(
  withSentryCall("getInviteCode", async (request) => {
    const uid = request.auth?.uid;
    if (!uid) throw new HttpsError("unauthenticated", "Sign in first.");
    const reset = parseReset(request.data);
    const db = getFirestore();
    const me = await callerUserDoc(db, uid);

    const code = await db.runTransaction(async (tx) => {
      const user = await tx.get(me.ref);
      const current = user.get("inviteCode") as string | undefined;
      if (current && !reset) {
        // Only trust it if invites/ still agrees (e.g. it wasn't hand-edited).
        const invite = await tx.get(db.collection("invites").doc(current));
        if (invite.exists && invite.get("inviterId") === me.id) return current;
      }
      if (current) tx.delete(db.collection("invites").doc(current));
      // 60 random bits: a clash is vanishingly unlikely, and tx.create fails loudly if so.
      const next = newInviteCode();
      tx.create(db.collection("invites").doc(next), {
        inviterId: me.id,
        createdAt: FieldValue.serverTimestamp(),
      });
      tx.update(me.ref, { inviteCode: next });
      return next;
    });
    return { code };
  }),
);

/**
 * Open someone's invite: you're friends from here on. A request pending either way is
 * accepted, and if you're already friends nothing changes. A friendship that starts here
 * earns the inviter their first-invite milestone, and both of you the first-friend one.
 */
export const acceptInvite = onCall(
  withSentryCall("acceptInvite", async (request) => {
    const uid = request.auth?.uid;
    if (!uid) throw new HttpsError("unauthenticated", "Sign in first.");
    const code = parseInviteCode(request.data);
    if (!code) throw new HttpsError("invalid-argument", "Expected { code }.");
    const db = getFirestore();

    const invite = await db.collection("invites").doc(code).get();
    const inviterId = invite.get("inviterId") as string | undefined;
    if (!invite.exists || !inviterId) throw new HttpsError("not-found", "No such invite.");

    const me = await callerUserDoc(db, uid);
    if (me.id === inviterId) return { state: "self" as const, inviterId };
    const other = await db.collection("users").doc(inviterId).get();
    if (!other.exists || typeof other.get("userId") !== "string") {
      throw new HttpsError("not-found", "No such invite.");
    }

    const pairRef = db.collection("friendships").doc(pairId(me.id, other.id));
    const action = await db.runTransaction(async (tx) => {
      const pair = await tx.get(pairRef);
      const next = planInvite(friendState(pair.exists ? pair.data() : undefined, me.id));
      if (next === "noop") return next;
      writeAccepted(
        tx,
        { db, me, other, pairRef },
        next === "create-accepted" ? { requester: other.id, via: "invite" } : undefined,
      );
      return next;
    });

    // After the friendship is saved, and never holding it up (as friends.ts does).
    if (action !== "noop") {
      const awards = [
        { userId: other.id, item: FIRST_INVITE },
        { userId: other.id, item: FIRST_FRIEND },
        { userId: me.id, item: FIRST_FRIEND },
      ];
      await Promise.all(
        awards.map(({ userId, item }) =>
          awardMilestoneOnce({ db, userId, item }).catch((error) =>
            reportError(error, { action: "award_invite_milestone", level: "warning" }),
          ),
        ),
      );
    }
    return { state: "friends" as const, inviterId };
  }),
);
