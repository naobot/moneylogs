import { describe, it, expect } from "vite-plus/test";
import type { Timestamp } from "firebase/firestore";
import { giverIds, provenanceLabel, provenanceOf, shelfContents } from "../provenance";
import type { KnickKnackFind } from "../useUnseenFinds";

const ts = (ms: number) => ({ toMillis: () => ms }) as Timestamp;
let n = 0;
const found = (item: string, ms: number, seen = true): KnickKnackFind =>
  ({
    id: `f${n++}`,
    item,
    ledgerId: "l1",
    foundAt: ts(ms),
    seenAt: seen ? ts(ms + 1) : null,
  }) as KnickKnackFind;
const gift = (item: string, ms: number, from: string, seen = true): KnickKnackFind =>
  ({
    id: `g${n++}`,
    item,
    ledgerId: null,
    foundAt: ts(ms - 1000),
    seenAt: seen ? ts(ms + 1) : null,
    source: "gift",
    giftedBy: from,
    giftedAt: ts(ms),
  }) as KnickKnackFind;

const day = (ms: number) => `day${ms}`;
const names = (id: string) => ({ mina: "Mina" })[id] ?? "deleted user";

describe("provenance", () => {
  it("reads found, earned and gifted finds", () => {
    expect(provenanceOf(found("acorn", 5))).toEqual({ kind: "found", atMs: 5 });
    expect(provenanceOf({ ...found("copper_coin", 7), source: "milestone" })).toEqual({
      kind: "earned",
      atMs: 7,
    });
    expect(provenanceOf(gift("acorn", 9, "mina"))).toEqual({
      kind: "gift",
      atMs: 9,
      fromId: "mina",
    });
  });

  it("labels them", () => {
    expect(provenanceLabel({ kind: "found", atMs: 5 }, names, day)).toBe("found day5");
    expect(provenanceLabel({ kind: "found", atMs: null }, names, day)).toBe("found");
    expect(provenanceLabel({ kind: "earned", atMs: 7 }, names, day)).toBe("earned day7");
    expect(provenanceLabel({ kind: "gift", atMs: 9, fromId: "mina" }, names, day)).toBe(
      "gift from Mina · day9",
    );
    expect(provenanceLabel({ kind: "gift", atMs: 9, fromId: "gone" }, names, day)).toBe(
      "gift from deleted user · day9",
    );
  });
});

describe("shelfContents", () => {
  it("groups kept finds by item in the order first got, oldest copy first", () => {
    const shelf = shelfContents([
      found("acorn", 300),
      gift("holly", 100, "mina"),
      found("acorn", 200),
      found("daisy", 50, false),
      found("not_an_item", 10),
    ]);
    expect(shelf.map((s) => s.item)).toEqual(["holly", "acorn"]);
    expect(shelf[1].provenance).toEqual([
      { kind: "found", atMs: 200 },
      { kind: "found", atMs: 300 },
    ]);
  });

  it("lists who gave things", () => {
    expect(giverIds([gift("a", 1, "mina"), gift("b", 2, "mina"), found("c", 3)])).toEqual(["mina"]);
  });
});
