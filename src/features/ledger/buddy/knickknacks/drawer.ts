import { KNICK_KNACK_IDS, KnickKnackId } from "./catalog";
import type { KnickKnackFind } from "./useUnseenFinds";

export type DrawerSlot = { item: KnickKnackId; count: number; firstFoundMs: number };

const ms = (f: KnickKnackFind) => f.foundAt?.toMillis() ?? Number.MAX_SAFE_INTEGER;

/**
 * What the knick-knack drawer shows:
 * - kept: one slot per item you've seen, in the order you first got it, with how many
 *   you have;
 * - waiting: finds your budget buddy hasn't shown you yet, oldest first, from any log
 *   or none. The drawer reveals them itself, without saying what they are first;
 * - gifts: gifts from friends you haven't unwrapped yet, oldest first.
 * Finds for items this build doesn't know (a newer catalog) are left out until it updates.
 */
export const drawerContents = (finds: ReadonlyArray<KnickKnackFind>) => {
  const known = new Set<string>(KNICK_KNACK_IDS);
  const slots = new Map<KnickKnackId, DrawerSlot>();
  const waiting: KnickKnackFind[] = [];
  const gifts: KnickKnackFind[] = [];

  for (const find of [...finds].sort((a, b) => ms(a) - ms(b))) {
    if (!known.has(find.item)) continue;
    if (!find.seenAt) {
      (find.source === "gift" ? gifts : waiting).push(find);
      continue;
    }
    const slot = slots.get(find.item);
    if (slot) slot.count += 1;
    else slots.set(find.item, { item: find.item, count: 1, firstFoundMs: ms(find) });
  }

  return { kept: [...slots.values()], waiting, gifts };
};
