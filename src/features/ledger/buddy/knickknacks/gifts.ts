import { httpsCallable } from "firebase/functions";
import { functions } from "@/config/firebase-config";
import { KNICK_KNACK_IDS, KnickKnackId } from "./catalog";
import { FOREST_SPIRIT_ID } from "./provenance";
import type { KnickKnackFind } from "./useUnseenFinds";

/**
 * A find can be given to a friend once you've seen it, and only if you found it
 * yourself (or got from the forest spirit): gifts from friends can't be passed on, and milestone knick-knacks
 * (the ones that come with an achievement) stay with whoever earned them. Mirrors
 * functions/src/giftsPlan.ts (canGift).
 */
export const isGiftable = (find: Pick<KnickKnackFind, "seenAt" | "source" | "giftedBy">): boolean =>
  find.seenAt != null &&
  (find.source !== "gift" || find.giftedBy === FOREST_SPIRIT_ID) &&
  find.source !== "milestone";

const ms = (f: KnickKnackFind) => f.foundAt?.toMillis() ?? Number.MAX_SAFE_INTEGER;

/**
 * What you could give away: per item (in catalog order), the giftable finds, oldest
 * first. Giving an item hands over its oldest copy.
 */
export const giftableByItem = (finds: ReadonlyArray<KnickKnackFind>) => {
  const byItem = new Map<KnickKnackId, KnickKnackFind[]>();
  for (const find of [...finds].sort((a, b) => ms(a) - ms(b))) {
    if (!isGiftable(find)) continue;
    byItem.set(find.item, [...(byItem.get(find.item) ?? []), find]);
  }
  return KNICK_KNACK_IDS.filter((id) => byItem.has(id)).map((item) => ({
    item,
    finds: byItem.get(item)!,
  }));
};

const giftCallable = httpsCallable<{ findId: string; toUserDocId: string }, { ok: boolean }>(
  functions,
  "giftKnickKnack",
);

export const giftKnickKnack = (findId: string, toUserDocId: string) =>
  giftCallable({ findId, toUserDocId });
