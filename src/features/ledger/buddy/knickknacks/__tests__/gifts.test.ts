import { describe, it, expect, vi } from "vite-plus/test";
import type { Timestamp } from "firebase/firestore";

vi.mock("@/config/firebase-config", () => ({ functions: {} }));
vi.mock("firebase/functions", () => ({ httpsCallable: () => vi.fn() }));

import { giftableByItem, isGiftable } from "../gifts";
import type { KnickKnackFind } from "../useUnseenFinds";

const ts = (ms: number) => ({ toMillis: () => ms }) as Timestamp;
let n = 0;
const find = (item: string, ms: number, extra: Partial<KnickKnackFind> = {}) =>
  ({
    id: `f${n++}`,
    item,
    ledgerId: "l1",
    foundAt: ts(ms),
    seenAt: ts(ms + 1),
    ...extra,
  }) as KnickKnackFind;

describe("isGiftable", () => {
  it("only seen finds you found yourself", () => {
    expect(isGiftable(find("acorn", 1))).toBe(true);
    expect(isGiftable(find("acorn", 1, { seenAt: null }))).toBe(false);
    expect(isGiftable(find("acorn", 1, { source: "gift" }))).toBe(false);
  });

  it("keeps coins with whoever earned them", () => {
    expect(isGiftable(find("copper_coin", 1, { source: "milestone" }))).toBe(false);
  });
});

describe("giftableByItem", () => {
  it("groups giftable finds by item in catalog order, oldest first", () => {
    const old = find("acorn", 1);
    const newer = find("acorn", 5);
    const result = giftableByItem([
      newer,
      find("pinecone", 3),
      old,
      find("holly", 2, { source: "gift" }),
      find("daisy", 2, { seenAt: null }),
    ]);
    expect(result.map((r) => r.item)).toEqual(["acorn", "pinecone"]);
    expect(result[0].finds).toEqual([old, newer]);
  });
});
