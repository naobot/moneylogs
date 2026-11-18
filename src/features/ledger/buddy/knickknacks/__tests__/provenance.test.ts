import { describe, it, expect } from "vite-plus/test";
import type { Timestamp } from "firebase/firestore";
import {
  FOREST_SPIRIT_ID,
  giverIds,
  giverName,
  inTransitGifts,
  provenanceLabel,
  provenanceOf,
  shelfSlots,
} from "../provenance";
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

describe("shelfSlots", () => {
  it("reads each item once, with its first copy's provenance", () => {
    expect(
      shelfSlots([
        { item: "holly", kind: "gift", atMs: 100, fromId: "mina" },
        { item: "acorn", kind: "found", atMs: 200, fromId: null },
        { item: "copper_coin", kind: "earned", atMs: 300, fromId: null },
      ]),
    ).toEqual([
      { item: "holly", provenance: { kind: "gift", atMs: 100, fromId: "mina" } },
      { item: "acorn", provenance: { kind: "found", atMs: 200 } },
      { item: "copper_coin", provenance: { kind: "earned", atMs: 300 } },
    ]);
  });

  it("leaves out unknown items and anything malformed", () => {
    expect(
      shelfSlots([
        { item: "not_an_item", kind: "found", atMs: 1 },
        { item: "acorn", kind: "stolen", atMs: 1 },
        null,
        { item: "daisy", kind: "found" },
      ]),
    ).toEqual([{ item: "daisy", provenance: { kind: "found", atMs: null } }]);
    expect(shelfSlots(undefined)).toEqual([]);
  });

  it("lists who gave things", () => {
    const slots = shelfSlots([
      { item: "holly", kind: "gift", atMs: 1, fromId: "mina" },
      { item: "tulip", kind: "gift", atMs: 2, fromId: "mina" },
      { item: "acorn", kind: "found", atMs: 3 },
    ]);
    expect(giverIds(slots)).toEqual(["mina"]);
  });
});

describe("inTransitGifts", () => {
  it("lists only the giver's own unopened gifts, oldest first", () => {
    const finds = [
      gift("acorn", 300, "me", false),
      gift("acorn", 100, "me", false),
      gift("acorn", 200, "mina", false), // someone else's gift
      gift("acorn", 50, "me", true), // already opened: it's on the shelf
      found("acorn", 10, false), // their own find
    ];
    expect(inTransitGifts(finds, "me").map((g) => g.sentAtMs)).toEqual([100, 300]);
  });

  it("skips items this build doesn't know", () => {
    expect(inTransitGifts([gift("not_an_item", 100, "me", false)], "me")).toEqual([]);
  });
});

describe("forest spirit gifts", () => {
  const nameOf = (id: string) => ({ mina: "mina" })[id];

  it("names the forest spirit without looking up a profile", () => {
    expect(giverName(FOREST_SPIRIT_ID, () => "nope", "deleted user")).toBe("a forest spirit");
    expect(giverName("mina", nameOf, "deleted user")).toBe("mina");
    expect(giverName("gone", nameOf, "deleted user")).toBe("deleted user");
    expect(giverName(null, nameOf, "someone")).toBe("someone");
  });

  it("labels the shelf and leaves the spirit out of profile lookups", () => {
    expect(
      provenanceLabel(
        { kind: "gift", atMs: 9, fromId: FOREST_SPIRIT_ID },
        () => "x",
        (ms) => `d${ms}`,
      ),
    ).toBe("gift from a forest spirit · d9");
    expect(
      giverIds([
        { item: "acorn", provenance: { kind: "gift", atMs: 1, fromId: FOREST_SPIRIT_ID } },
        { item: "pebble", provenance: { kind: "gift", atMs: 2, fromId: "mina" } },
      ]),
    ).toEqual(["mina"]);
  });

  it("matches the backend's sentinel", async () => {
    const plan = await import("../../../../../../functions/src/giftsPlan");
    expect(plan.FOREST_SPIRIT_ID).toBe(FOREST_SPIRIT_ID);
  });
});
