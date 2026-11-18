import { describe, it, expect } from "vite-plus/test";
import { KNICK_KNACKS } from "@/features/ledger/buddy/knickknacks/catalog";
import { grantableItemGroups, inventoryRows } from "../adminItems";

describe("grantableItemGroups", () => {
  const groups = grantableItemGroups();
  const all = groups.flatMap((g) => g.items);

  it("never offers a milestone", () => {
    expect(all.length).toBeGreaterThan(0);
    expect(all.some((id) => KNICK_KNACKS[id].rarity === "milestone")).toBe(false);
  });

  it("offers every other item exactly once, rarest group first", () => {
    const expected = Object.keys(KNICK_KNACKS).filter(
      (id) => KNICK_KNACKS[id as keyof typeof KNICK_KNACKS].rarity !== "milestone",
    );
    expect([...all].sort()).toEqual([...expected].sort());
    expect(groups[0].rarity).toBe("special");
  });

  it("groups items by their rarity", () => {
    for (const group of groups) {
      for (const id of group.items) expect(KNICK_KNACKS[id].rarity).toBe(group.rarity);
    }
  });
});

describe("inventoryRows", () => {
  it("sorts by count, then name, and drops unknown ids", () => {
    expect(inventoryRows({ pebble: 2, acorn: 5, apple: 2, not_a_thing: 9 })).toEqual([
      { id: "acorn", name: KNICK_KNACKS.acorn.name, count: 5 },
      { id: "apple", name: KNICK_KNACKS.apple.name, count: 2 },
      { id: "pebble", name: KNICK_KNACKS.pebble.name, count: 2 },
    ]);
  });
});
