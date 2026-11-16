import { onCall, HttpsError } from "firebase-functions/v2/https";
import {
  DocumentReference,
  DocumentSnapshot,
  FieldValue,
  Firestore,
  getFirestore,
  Transaction,
} from "firebase-admin/firestore";
import {
  FriendAction,
  friendAcceptedNotificationId,
  friendRequestNotificationId,
  friendState,
  pairId,
  parseFriendRequest,
  planRemove,
  planRequest,
  planRespond,
} from "./friendsPlan";
import { isNotificationEnabled } from "./notificationPrefs";

/**
 * Friend requests. friendships/{pairId} is read-only to clients, so every change goes
 * through these callables, which also keep both inboxes tidy: a request notifies the
 * other person, accepting notifies the requester, and cancelling, declining or
 * unfriending removes the request notification that's no longer true.
 */

type Parties = {
  db: Firestore;
  me: DocumentSnapshot;
  other: DocumentSnapshot;
  pairRef: DocumentReference;
};

const inbox = (db: Firestore, userDocId: string) =>
  db.collection("users").doc(userDocId).collection("notifications");

/** Resolve the caller's and the other person's user docs, or throw. */
const parties = async (
  uid: string | undefined,
  data: unknown,
): Promise<Parties & { accept?: boolean }> => {
  if (!uid) throw new HttpsError("unauthenticated", "Sign in first.");
  const req = parseFriendRequest(data);
  if (!req) throw new HttpsError("invalid-argument", "Expected { otherUserDocId }.");

  const db = getFirestore();
  const mine = await db.collection("users").where("userId", "==", uid).limit(1).get();
  if (mine.empty) throw new HttpsError("failed-precondition", "No user profile.");
  const me = mine.docs[0];
  if (me.id === req.otherUserDocId) {
    throw new HttpsError("invalid-argument", "That's you.");
  }
  const other = await db.collection("users").doc(req.otherUserDocId).get();
  if (!other.exists || typeof other.get("userId") !== "string") {
    throw new HttpsError("not-found", "No such user.");
  }
  return {
    db,
    me,
    other,
    pairRef: db.collection("friendships").doc(pairId(me.id, other.id)),
    accept: req.accept,
  };
};

/** Apply a planned change inside the transaction, with its notifications. */
const apply = (tx: Transaction, action: FriendAction, { db, me, other, pairRef }: Parties) => {
  const meName = (me.get("displayName") as string | undefined) ?? "someone";
  // Whatever happens, a pending request between these two is no longer pending.
  const clearRequests = () => {
    tx.delete(inbox(db, other.id).doc(friendRequestNotificationId(me.id)));
    tx.delete(inbox(db, me.id).doc(friendRequestNotificationId(other.id)));
  };

  switch (action) {
    case "create": {
      const users = [me.id, other.id].sort();
      const uidOf = (id: string) => (id === me.id ? me.get("userId") : other.get("userId"));
      tx.set(pairRef, {
        users,
        uids: users.map(uidOf),
        requester: me.id,
        status: "pending",
        createdAt: FieldValue.serverTimestamp(),
      });
      if (isNotificationEnabled(other.data(), "friend_request")) {
        tx.set(inbox(db, other.id).doc(friendRequestNotificationId(me.id)), {
          type: "friend_request",
          actorId: me.id,
          actorName: meName,
          createdAt: FieldValue.serverTimestamp(),
          readAt: null,
        });
      }
      return;
    }
    case "accept":
      tx.update(pairRef, { status: "accepted", acceptedAt: FieldValue.serverTimestamp() });
      clearRequests();
      if (isNotificationEnabled(other.data(), "friend_accepted")) {
        tx.set(inbox(db, other.id).doc(friendAcceptedNotificationId(me.id)), {
          type: "friend_accepted",
          actorId: me.id,
          actorName: meName,
          createdAt: FieldValue.serverTimestamp(),
          readAt: null,
        });
      }
      return;
    case "delete":
      tx.delete(pairRef);
      clearRequests();
      return;
    case "noop":
      return;
  }
};

/** Run one friend call: read the pair, plan, apply, and report where things stand. */
const run = async (
  uid: string | undefined,
  data: unknown,
  plan: (state: ReturnType<typeof friendState>, accept?: boolean) => FriendAction | "invalid",
) => {
  const p = await parties(uid, data);
  return p.db.runTransaction(async (tx) => {
    const pair = await tx.get(p.pairRef);
    const state = friendState(pair.exists ? pair.data() : undefined, p.me.id);
    const action = plan(state, p.accept);
    if (action === "invalid") {
      throw new HttpsError("failed-precondition", "There's no request to answer.");
    }
    apply(tx, action, p);
    const after =
      action === "create"
        ? "outgoing"
        : action === "accept"
          ? "friends"
          : action === "delete"
            ? "none"
            : state;
    return { state: after };
  });
};

/** Ask someone to be friends (accepts instead if they already asked you). */
export const requestFriend = onCall((request) =>
  run(request.auth?.uid, request.data, (state) => planRequest(state)),
);

/** Accept or decline a request someone sent you. */
export const respondFriend = onCall((request) =>
  run(request.auth?.uid, request.data, (state, accept) => {
    if (accept === undefined) throw new HttpsError("invalid-argument", "Expected { accept }.");
    return planRespond(state, accept);
  }),
);

/** Cancel your request, decline theirs, or unfriend. */
export const removeFriend = onCall((request) =>
  run(request.auth?.uid, request.data, (state) => planRemove(state)),
);
