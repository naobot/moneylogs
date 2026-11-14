import { describe, it, expect } from "vite-plus/test";
import type { Timestamp } from "firebase/firestore";
import { drawerContents } from "../drawer";
import type { KnickKnackFind } from "../useUnseenFinds";

const ts = (ms: number) => ({ toMillis: () => ms }) as Timestamp;
let n = 0;
const find = (item: string, foundMs: number, seen = true, ledgerId = "l1"): KnickKnackFind =>
  ({
    id: `f${n++}`,
    item,
    ledgerId,
    foundAt: ts(foundMs),
    seenAt: seen ? ts(foundMs + 1) : null,
  }) as KnickKnackFind;

describe("drawerContents", () => {
  it("is empty with no finds", () => {
    expect(drawerContents([])).toEqual({ kept: [], waiting: [] });
  });

  it("keeps one slot per item, in the order first found, with counts", () => {
    const { kept } = drawerContents([
      find("acorn", 300),
      find("holly", 100),
      find("acorn", 200),
      find("acorn", 400),
    ]);
    expect(kept).toEqual([
      { item: "holly", count: 1, firstFoundMs: 100 },
      { item: "acorn", count: 3, firstFoundMs: 200 },
    ]);
  });

  it("keeps finds the buddy hasn't shown yet wrapped, by log", () => {
    const { kept, waiting } = drawerContents([
      find("acorn", 100),
      find("tulip", 200, false, "l1"),
      find("daisy", 300, false, "l2"),
      find("lilac", 400, false, "l1"),
    ]);
    expect(kept.map((s) => s.item)).toEqual(["acorn"]);
    expect(waiting).toEqual([
      { ledgerId: "l1", count: 2 },
      { ledgerId: "l2", count: 1 },
    ]);
  });

  it("leaves out items this build doesn't know yet", () => {
    expect(drawerContents([find("moon_rock", 100), find("moon_rock", 200, false)])).toEqual({
      kept: [],
      waiting: [],
    });
  });
});
