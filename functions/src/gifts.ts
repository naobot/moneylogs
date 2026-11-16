import { onCall, HttpsError } from "firebase-functions/v2/https";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { pairId } from "./friendsPlan";
import { giftBlock, giftNotificationId, parseGiftRequest } from "./giftsPlan";
import { isNotificationEnabled } from "./notificationPrefs";

const BLOCK_MESSAGES = {
  missing: "That knick-knack isn't in your drawer any more.",
  unseen: "Open it first before giving it away.",
  was_gift: "Gifts can't be passed on.",
} as const;

/**
 * Give one of your knick-knacks to a friend. In one transaction the find leaves your
 * drawer and a wrapped copy (same item, same original find date) lands in theirs,
 * recording who gave it and when, with a notification that doesn't spoil what's inside.
 */
export const giftKnickKnack = onCall(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError("unauthenticated", "Sign in first.");
  const req = parseGiftRequest(request.data);
  if (!req) throw new HttpsError("invalid-argument", "Expected { findId, toUserDocId }.");

  const db = getFirestore();
  const mine = await db.collection("users").where("userId", "==", uid).limit(1).get();
  if (mine.empty) throw new HttpsError("failed-precondition", "No user profile.");
  const me = mine.docs[0];
  if (me.id === req.toUserDocId) throw new HttpsError("invalid-argument", "That's you.");

  const users = db.collection("users");
  const findRef = users.doc(me.id).collection("knickknacks").doc(req.findId);
  const toRef = users.doc(req.toUserDocId);
  const pairRef = db.collection("friendships").doc(pairId(me.id, req.toUserDocId));
  const giftRef = toRef.collection("knickknacks").doc();

  await db.runTransaction(async (tx) => {
    const [find, to, pair] = await Promise.all([tx.get(findRef), tx.get(toRef), tx.get(pairRef)]);
    if (!to.exists) throw new HttpsError("not-found", "No such user.");
    if (!pair.exists || pair.get("status") !== "accepted") {
      throw new HttpsError("permission-denied", "You can only give gifts to friends.");
    }
    const block = giftBlock(find.exists ? find.data() : undefined);
    if (block) throw new HttpsError("failed-precondition", BLOCK_MESSAGES[block]);

    tx.create(giftRef, {
      item: find.get("item"),
      ledgerId: null,
      foundAt: find.get("foundAt") ?? null,
      seenAt: null,
      source: "gift",
      giftedBy: me.id,
      giftedAt: FieldValue.serverTimestamp(),
    });
    tx.delete(findRef);

    if (isNotificationEnabled(to.data(), "gift_received")) {
      tx.set(toRef.collection("notifications").doc(giftNotificationId(giftRef.id)), {
        type: "gift_received",
        actorId: me.id,
        actorName: (me.get("displayName") as string | undefined) ?? "someone",
        findId: giftRef.id,
        createdAt: FieldValue.serverTimestamp(),
        readAt: null,
      });
    }
  });

  return { ok: true };
});
