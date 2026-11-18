import {
  DocumentReference,
  DocumentSnapshot,
  FieldValue,
  Firestore,
} from "firebase-admin/firestore";
import { FOREST_SPIRIT_ID, FOREST_SPIRIT_NAME, giftNotificationId } from "./giftsPlan";
import { KNICK_KNACK_FINDS } from "./knickknacks";
import { isNotificationEnabled } from "./notificationPrefs";

/**
 * Hand-made knick-knack writes, shared by the admin panel (admin.ts) and the CLI scripts
 * (scripts/forest-gift.ts, scripts/grant-special.ts) so both write identical docs.
 * Callers validate the item (grantBlock / spiritGiftBlock in adminPlan.ts / giftsPlan.ts)
 * and the count. Not idempotent: each call adds `count` more.
 */

/**
 * Send knick-knacks as gifts from "a forest spirit". They arrive wrapped (unseen) like a
 * friend's gift, with one "gift_received" notification for the lot (unless the person
 * has switched those off), so the push and email digest go out as usual.
 */
export const sendSpiritGift = async (
  db: Firestore,
  user: DocumentSnapshot,
  item: string,
  count: number,
): Promise<{ notified: boolean }> => {
  const notify = isNotificationEnabled(user.data(), "gift_received");
  const batch = db.batch();
  const finds = user.ref.collection("knickknacks");
  const giftIds: string[] = [];
  for (let i = 0; i < count; i++) {
    const giftRef = finds.doc();
    giftIds.push(giftRef.id);
    batch.create(giftRef, {
      item,
      ledgerId: null,
      foundAt: FieldValue.serverTimestamp(),
      seenAt: null,
      source: "gift",
      giftedBy: FOREST_SPIRIT_ID,
      giftedAt: FieldValue.serverTimestamp(),
    });
  }
  // One notification however many copies: it doesn't say what's inside.
  if (notify) {
    batch.set(user.ref.collection("notifications").doc(giftNotificationId(giftIds[0])), {
      type: "gift_received",
      actorId: FOREST_SPIRIT_ID,
      actorName: FOREST_SPIRIT_NAME,
      findId: giftIds[0],
      createdAt: FieldValue.serverTimestamp(),
      readAt: null,
    });
  }
  await batch.commit();
  return { notified: notify };
};

/**
 * Add knick-knacks already kept (seen), straight into the drawer rather than as finds for
 * the buddy to reveal. Specials keep their "special" source; anything else is "granted".
 * Both show as found on the shelf and can be given to friends like ordinary finds.
 */
export const grantKept = async (
  db: Firestore,
  userRef: DocumentReference,
  item: string,
  count: number,
): Promise<void> => {
  const rarity = (KNICK_KNACK_FINDS as Record<string, { rarity: string } | undefined>)[item]
    ?.rarity;
  const source = rarity === "special" ? "special" : "granted";
  const batch = db.batch();
  for (let i = 0; i < count; i++) {
    batch.create(userRef.collection("knickknacks").doc(), {
      item,
      ledgerId: null,
      foundAt: FieldValue.serverTimestamp(),
      seenAt: FieldValue.serverTimestamp(),
      source,
    });
  }
  await batch.commit();
};
