/**
 * Public knick-knack shelves: shelves/{userDocId}, the only view other people get of
 * someone's knick-knacks. Each kept item appears once, with how the first copy came to
 * them, so how many of anything someone has stays private. users/{id}/knickknacks is
 * owner-only (firestore.rules). Pure helpers live here so root Vitest can test them.
 */

type TimestampLike = { toMillis: () => number } | null | undefined;

export type ShelfFind = {
  item?: unknown;
  seenAt?: TimestampLike;
  source?: unknown;
  foundAt?: TimestampLike;
  giftedAt?: TimestampLike;
  giftedBy?: unknown;
};

/** One item on a shelf: how its first copy came to its owner. */
export type ShelfItem = {
  item: string;
  kind: "found" | "earned" | "gift";
  atMs: number | null;
  /** Gifts only: the giver's user doc id. */
  fromId: string | null;
};

const ms = (t: TimestampLike) => (t && typeof t.toMillis === "function" ? t.toMillis() : null);

const firstGotMs = (f: ShelfFind) =>
  (f.source === "gift" ? ms(f.giftedAt) : ms(f.foundAt)) ?? Number.MAX_SAFE_INTEGER;

/**
 * The shelf from someone's finds: kept (seen) ones only, each item once, in the order
 * they first got it. Unseen finds stay a surprise and aren't shown.
 */
export const shelfOf = (finds: ReadonlyArray<ShelfFind>): ShelfItem[] => {
  const seen = new Set<string>();
  const items: ShelfItem[] = [];
  for (const f of [...finds].sort((a, b) => firstGotMs(a) - firstGotMs(b))) {
    if (typeof f.item !== "string" || f.seenAt == null || seen.has(f.item)) continue;
    seen.add(f.item);
    items.push(
      f.source === "gift"
        ? {
            item: f.item,
            kind: "gift",
            atMs: ms(f.giftedAt),
            fromId: typeof f.giftedBy === "string" ? f.giftedBy : null,
          }
        : {
            item: f.item,
            kind: f.source === "milestone" ? "earned" : "found",
            atMs: ms(f.foundAt),
            fromId: null,
          },
    );
  }
  return items;
};

/** Whether two shelves show the same thing (to skip writes that change nothing). */
export const sameShelf = (a: ReadonlyArray<ShelfItem>, b: ReadonlyArray<ShelfItem>) =>
  JSON.stringify(a) === JSON.stringify(b);
