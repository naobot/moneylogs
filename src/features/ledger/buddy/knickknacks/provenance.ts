import { KNICK_KNACK_IDS, KnickKnackId } from "./catalog";
import type { KnickKnackFind } from "./useUnseenFinds";

/**
 * Gifts sent by hand from the backend (functions/scripts/forest-gift.ts) rather than
 * by a friend carry this sentinel as `giftedBy`. It's never a user doc id, so it's never
 * looked up as a profile. Mirrors functions/src/giftsPlan.ts.
 */
export const FOREST_SPIRIT_ID = "~forest-spirit";
export const FOREST_SPIRIT_NAME = "a forest spirit";

/**
 * The name to show for a gift's giver: the forest spirit, the giver's profile name, or
 * `fallback` (no giver, or a deleted account).
 */
export const giverName = (
  id: string | null | undefined,
  nameOf: (userDocId: string) => string | undefined,
  fallback: string,
): string => {
  if (id === FOREST_SPIRIT_ID) return FOREST_SPIRIT_NAME;
  return (id && nameOf(id)) || fallback;
};

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
  const from = `gift from ${giverName(p.fromId, nameOf, "someone")}`;
  return when ? `${from} · ${when}` : from;
};

/**
 * One item on a profile's knick-knack shelf: shelves/{userDocId}, written by the
 * mirrorShelf Cloud Function. Each kept item appears once, with how its first copy came
 * to its owner: how many of anything someone has is private.
 */
export type ShelfSlot = { item: KnickKnackId; provenance: Provenance };

const KINDS = new Set(["found", "earned", "gift"]);

/**
 * A shelf doc's items, checked. Items this build doesn't know (a newer catalog) and
 * anything malformed are left out.
 */
export const shelfSlots = (items: unknown): ShelfSlot[] => {
  if (!Array.isArray(items)) return [];
  const known = new Set<string>(KNICK_KNACK_IDS);
  return items.flatMap((raw): ShelfSlot[] => {
    const { item, kind, atMs, fromId } = (raw ?? {}) as Record<string, unknown>;
    if (typeof item !== "string" || !known.has(item) || !KINDS.has(kind as string)) return [];
    const at = typeof atMs === "number" ? atMs : null;
    const provenance: Provenance =
      kind === "gift"
        ? { kind, atMs: at, fromId: typeof fromId === "string" ? fromId : null }
        : { kind: kind as "found" | "earned", atMs: at };
    return [{ item: item as KnickKnackId, provenance }];
  });
};

/** Ids of everyone who gave anything on a shelf, to look up their names. */
export const giverIds = (slots: ReadonlyArray<ShelfSlot>): string[] => [
  ...new Set(
    slots.flatMap(({ provenance: p }) =>
      p.kind === "gift" && p.fromId && p.fromId !== FOREST_SPIRIT_ID ? [p.fromId] : [],
    ),
  ),
];

/** A gift the viewer sent that's still wrapped in the friend's drawer. */
export type InTransitGift = { id: string; item: KnickKnackId; sentAtMs: number | null };

/**
 * The viewer's own gifts still waiting to be opened, oldest first. Only gifts from
 * `giverId` count (firestore.rules allows reading no others; this filter keeps that true
 * on the client too), and only unseen ones: once opened, the gift is on the shelf.
 */
export const inTransitGifts = (
  finds: ReadonlyArray<KnickKnackFind>,
  giverId: string,
): InTransitGift[] => {
  const known = new Set<string>(KNICK_KNACK_IDS);
  return finds
    .filter(
      (f) => f.source === "gift" && f.giftedBy === giverId && f.seenAt == null && known.has(f.item),
    )
    .map((f) => ({ id: f.id, item: f.item, sentAtMs: f.giftedAt?.toMillis() ?? null }))
    .sort((a, b) => (a.sentAtMs ?? Infinity) - (b.sentAtMs ?? Infinity));
};
