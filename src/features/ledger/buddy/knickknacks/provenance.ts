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
    slots.flatMap(({ provenance: p }) => (p.kind === "gift" && p.fromId ? [p.fromId] : [])),
  ),
];
