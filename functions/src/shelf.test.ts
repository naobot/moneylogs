import { describe, it, expect } from "vite-plus/test";
import { sameShelf, shelfOf, ShelfFind } from "./shelf";

const ts = (ms: number) => ({ toMillis: () => ms });
const found = (item: string, ms: number, seen = true): ShelfFind => ({
  item,
  foundAt: ts(ms),
  seenAt: seen ? ts(ms + 1) : null,
});

describe("shelfOf", () => {
  it("shows each kept item once, however many copies, in the order first got", () => {
    const shelf = shelfOf([
      found("acorn", 300),
      found("acorn", 200),
      found("acorn", 400),
      { item: "holly", source: "gift", giftedBy: "mina", giftedAt: ts(100), seenAt: ts(101) },
    ]);
    expect(shelf).toEqual([
      { item: "holly", kind: "gift", atMs: 100, fromId: "mina" },
      { item: "acorn", kind: "found", atMs: 200, fromId: null },
    ]);
    // Nothing on it says how many acorns there are.
    expect(JSON.stringify(shelf)).not.toMatch(/count|300|400/);
  });

  it("leaves out unseen finds", () => {
    expect(shelfOf([found("daisy", 5, false)])).toEqual([]);
  });

  it("marks milestones as earned", () => {
    expect(shelfOf([{ ...found("copper_coin", 7), source: "milestone" }])).toEqual([
      { item: "copper_coin", kind: "earned", atMs: 7, fromId: null },
    ]);
  });

  it("doesn't change when another copy of something already shown arrives", () => {
    const before = shelfOf([found("acorn", 1)]);
    const after = shelfOf([found("acorn", 1), found("acorn", 9)]);
    expect(sameShelf(before, after)).toBe(true);
  });
});
