import { KNICK_KNACK_IDS, KnickKnackId } from "./catalog";
import type { KnickKnackFind } from "./useUnseenFinds";

/** How one knick-knack came to its owner. */
export type Provenance =
  | { kind: "found"; atMs: number | null }
  | { kind: "earned"; atMs: number | null }
  | { kind: "gift"; atMs: number | null; fromId: string | null };

export const provenanceOf = (find: KnickKnackFind): Provenance =>
  find.source === "gift"
    ? {
        kind: "gift",
        atMs: find.giftedAt?.toMillis() ?? null,
        fromId: find.giftedBy ?? null,
      }
    : {
        kind: find.source === "milestone" ? "earned" : "found",
        atMs: find.foundAt?.toMillis() ?? null,
      };

/** "found 3 Nov" · "earned 5 Nov" · "gift from mina · 12 Nov" (dates via the viewer's format). */
export const provenanceLabel = (
  p: Provenance,
  nameOf: (userDocId: string) => string,
  formatDay: (ms: number) => string,
): string => {
  const when = p.atMs != null ? formatDay(p.atMs) : null;
  if (p.kind !== "gift") return when ? `${p.kind} ${when}` : p.kind;
  const from = `gift from ${p.fromId ? nameOf(p.fromId) : "someone"}`;
  return when ? `${from} · ${when}` : from;
};

export type ShelfSlot = { item: KnickKnackId; provenance: Provenance[] };

const firstMs = (f: KnickKnackFind) =>
  (f.source === "gift" ? f.giftedAt : f.foundAt)?.toMillis() ?? Number.MAX_SAFE_INTEGER;

/**
 * A profile's knick-knack shelf: one slot per kept item in the order its owner first got
 * it, each with how every copy came to them (oldest first). Unseen finds and items this
 * build doesn't know are left out.
 */
export const shelfContents = (finds: ReadonlyArray<KnickKnackFind>): ShelfSlot[] => {
  const known = new Set<string>(KNICK_KNACK_IDS);
  const slots = new Map<KnickKnackId, ShelfSlot>();
  for (const find of [...finds].sort((a, b) => firstMs(a) - firstMs(b))) {
    if (!known.has(find.item) || !find.seenAt) continue;
    const slot = slots.get(find.item) ?? { item: find.item, provenance: [] };
    slot.provenance.push(provenanceOf(find));
    slots.set(find.item, slot);
  }
  return [...slots.values()];
};

/** Ids of everyone who gave any of these finds, to look up their names. */
export const giverIds = (finds: ReadonlyArray<KnickKnackFind>): string[] => [
  ...new Set(finds.flatMap((f) => (f.source === "gift" && f.giftedBy ? [f.giftedBy] : []))),
];
