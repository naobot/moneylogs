import {
  KNICK_KNACKS,
  KNICK_KNACK_IDS,
  KnickKnackId,
  RARITY_LABELS,
  Rarity,
} from "@/features/ledger/buddy/knickknacks/catalog";

/** Rarities the admin panel can hand out, rarest first. Milestones are earned only. */
export const GRANTABLE_RARITIES = [
  "special",
  "rare",
  "common",
  "super_common",
] as const satisfies readonly Rarity[];

export type ItemGroup = { rarity: string; label: string; items: KnickKnackId[] };

/** Every non-milestone knick-knack, grouped by rarity (rarest first), names A–Z. */
export const grantableItemGroups = (): ItemGroup[] =>
  GRANTABLE_RARITIES.map((rarity) => ({
    rarity,
    label: RARITY_LABELS[rarity],
    items: KNICK_KNACK_IDS.filter((id) => KNICK_KNACKS[id].rarity === rarity).sort((a, b) =>
      KNICK_KNACKS[a].name.localeCompare(KNICK_KNACKS[b].name),
    ),
  })).filter((group) => group.items.length > 0);

/** Inventory counts as rows, most-held first, unknown ids dropped. */
export const inventoryRows = (
  counts: Record<string, number>,
): { id: KnickKnackId; name: string; count: number }[] =>
  Object.entries(counts)
    .filter((entry): entry is [KnickKnackId, number] => entry[0] in KNICK_KNACKS)
    .map(([id, count]) => ({ id, name: KNICK_KNACKS[id].name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
