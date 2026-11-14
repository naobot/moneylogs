import { KNICK_KNACK_IDS, KnickKnackId } from "./catalog";
import type { KnickKnackFind } from "./useUnseenFinds";

export type DrawerSlot = { item: KnickKnackId; count: number; firstFoundMs: number };

const ms = (f: KnickKnackFind) => f.foundAt?.toMillis() ?? Number.MAX_SAFE_INTEGER;

/**
 * What the knick-knack drawer shows:
 * - kept: one slot per item the buddy has shown you, in the order you first got it,
 *   with how many you have;
 * - waiting: finds the buddy hasn't shown you yet, by log, so the drawer can point you
 *   to it without spoiling what's inside.
 * Finds for items this build doesn't know (a newer catalog) are left out until it updates.
 */
export const drawerContents = (finds: ReadonlyArray<KnickKnackFind>) => {
  const known = new Set<string>(KNICK_KNACK_IDS);
  const slots = new Map<KnickKnackId, DrawerSlot>();
  const waiting = new Map<string, number>();

  for (const find of [...finds].sort((a, b) => ms(a) - ms(b))) {
    if (!known.has(find.item)) continue;
    if (!find.seenAt) {
      waiting.set(find.ledgerId, (waiting.get(find.ledgerId) ?? 0) + 1);
      continue;
    }
    const slot = slots.get(find.item);
    if (slot) slot.count += 1;
    else slots.set(find.item, { item: find.item, count: 1, firstFoundMs: ms(find) });
  }

  return {
    kept: [...slots.values()],
    waiting: [...waiting].map(([ledgerId, count]) => ({ ledgerId, count })),
  };
};
