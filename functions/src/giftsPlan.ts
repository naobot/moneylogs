/**
 * Pure rules for gifting knick-knacks, kept free of the SDK for root Vitest.
 * A gift moves the find: it leaves the giver's drawer and arrives wrapped (unseen) in
 * the friend's. Any find the giver has already seen can go, gifts included (re-gifted,
 * the new copy names the new giver), except milestone knick-knacks, which stay with
 * whoever earned them.
 */

const DOC_ID = /^[A-Za-z0-9_-]{1,128}$/;

/**
 * Gifts sent by hand from the backend (scripts/forest-gift.ts), from no one in
 * particular. `giftedBy` holds this sentinel instead of a user doc id; the app shows it as
 * FOREST_SPIRIT_NAME. Mirrors src/features/ledger/buddy/knickknacks/provenance.ts.
 */
export const FOREST_SPIRIT_ID = "~forest-spirit";
export const FOREST_SPIRIT_NAME = "a forest spirit";

export const parseGiftRequest = (data: unknown): { findId: string; toUserDocId: string } | null => {
  if (!data || typeof data !== "object") return null;
  const { findId, toUserDocId } = data as Record<string, unknown>;
  if (typeof findId !== "string" || !DOC_ID.test(findId)) return null;
  if (typeof toUserDocId !== "string" || !DOC_ID.test(toUserDocId)) return null;
  return { findId, toUserDocId };
};

export type GiftBlock = "missing" | "unseen" | "milestone";

/** Why a find can't be given, or null if it can. */
export const giftBlock = (find: Record<string, unknown> | undefined): GiftBlock | null => {
  if (!find) return "missing";
  if (find.seenAt == null) return "unseen";
  // Milestones are earned, not found: they stay with the person who earned them.
  if (find.source === "milestone") return "milestone";
  return null;
};

export const canGift = (find: Record<string, unknown> | undefined) => giftBlock(find) === null;

/** One notification per gift (by the recipient's new find id). */
export const giftNotificationId = (newFindId: string) => `gift_${newFindId}`;

/**
 * Why an item can't come from the forest spirit, or null if it can. Milestone
 * knick-knacks are earned, never given (as a gift they'd lose their achievement).
 */
export const spiritGiftBlock = (
  item: string,
  catalog: Record<string, { rarity: string } | undefined>,
): "unknown" | "milestone" | null => {
  const info = catalog[item];
  if (!info) return "unknown";
  if (info.rarity === "milestone") return "milestone";
  return null;
};
