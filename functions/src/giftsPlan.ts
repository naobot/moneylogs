/**
 * Pure rules for gifting knick-knacks, kept free of the SDK for root Vitest.
 * A gift moves the find: it leaves the giver's drawer and arrives wrapped (unseen) in
 * the friend's. Only finds the giver found themselves, and has already seen, can go:
 * gifts can't be passed on.
 */

const DOC_ID = /^[A-Za-z0-9_-]{1,128}$/;

export const parseGiftRequest = (data: unknown): { findId: string; toUserDocId: string } | null => {
  if (!data || typeof data !== "object") return null;
  const { findId, toUserDocId } = data as Record<string, unknown>;
  if (typeof findId !== "string" || !DOC_ID.test(findId)) return null;
  if (typeof toUserDocId !== "string" || !DOC_ID.test(toUserDocId)) return null;
  return { findId, toUserDocId };
};

export type GiftBlock = "missing" | "unseen" | "was_gift";

/** Why a find can't be given, or null if it can. */
export const giftBlock = (find: Record<string, unknown> | undefined): GiftBlock | null => {
  if (!find) return "missing";
  if (find.seenAt == null) return "unseen";
  if (find.source === "gift") return "was_gift";
  return null;
};

export const canGift = (find: Record<string, unknown> | undefined) => giftBlock(find) === null;

/** One notification per gift (by the recipient's new find id). */
export const giftNotificationId = (newFindId: string) => `gift_${newFindId}`;
