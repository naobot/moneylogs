import { describe, it, expect } from "vite-plus/test";
import {
  applyCategoryOp,
  applyCategoryOps,
  categoryNameError,
  MAX_CATEGORIES,
  newCategoryId,
  normaliseOrder,
} from "@/utils/ledgerCategories";
import { LedgerCategory } from "@/types/ledger";

const cats = (): LedgerCategory[] => [
  { id: "food", name: "Food", order: 0 },
  { id: "transport", name: "Transport", order: 1 },
  { id: "rent", name: "Rent", order: 2 },
  { id: "old", name: "Old", order: 3, archived: true },
];
const names = (list: LedgerCategory[]) => list.map((c) => `${c.name}${c.archived ? "*" : ""}`);

describe("categoryNameError", () => {
  it("rejects empty, too long and duplicate names (case/space-insensitive)", () => {
    expect(categoryNameError("   ", cats())).toMatch(/empty/);
    expect(categoryNameError("x".repeat(21), cats())).toMatch(/20 characters/);
    expect(categoryNameError("  food ", cats())).toMatch(/already exists/);
    expect(categoryNameError("OLD", cats())).toMatch(/archived.*restore/);
    expect(categoryNameError("Coffee", cats())).toBeUndefined();
  });

  it("lets a category keep its own name when renaming", () => {
    expect(categoryNameError("FOOD", cats(), "food")).toBeUndefined();
  });
});

describe("newCategoryId", () => {
  it("slugifies and de-duplicates", () => {
    expect(newCategoryId("Eating Out!", cats())).toBe("eating-out");
    expect(newCategoryId("Food", cats())).toBe("food-2");
    expect(newCategoryId("Food", [...cats(), { id: "food-2", name: "x", order: 9 }])).toBe(
      "food-3",
    );
    expect(newCategoryId("☕", cats())).toBe("category");
  });
});

describe("normaliseOrder", () => {
  it("puts active categories first and renumbers", () => {
    const list = normaliseOrder([
      { id: "a", name: "A", order: 5, archived: true },
      { id: "b", name: "B", order: 9 },
      { id: "c", name: "C", order: 1 },
    ]);
    expect(list.map((c) => [c.id, c.order])).toEqual([
      ["c", 0],
      ["b", 1],
      ["a", 2],
    ]);
  });
});

describe("applyCategoryOp", () => {
  it("adds after the active categories, before archived ones", () => {
    const list = applyCategoryOp(cats(), { type: "add", id: "coffee", name: " Coffee " });
    expect(names(list)).toEqual(["Food", "Transport", "Rent", "Coffee", "Old*"]);
  });

  it("skips adds that clash or exceed the cap", () => {
    expect(applyCategoryOp(cats(), { type: "add", id: "x", name: "food" })).toHaveLength(4);
    const full = Array.from({ length: MAX_CATEGORIES }, (_, i) => ({
      id: `c${i}`,
      name: `C${i}`,
      order: i,
    }));
    expect(applyCategoryOp(full, { type: "add", id: "x", name: "New" })).toHaveLength(
      MAX_CATEGORIES,
    );
  });

  it("renames, keeping the id", () => {
    const list = applyCategoryOp(cats(), { type: "rename", id: "food", name: "Eating out" });
    expect(list[0]).toMatchObject({ id: "food", name: "Eating out" });
  });

  it("moves within the active list and clamps the index", () => {
    expect(names(applyCategoryOp(cats(), { type: "move", id: "rent", toIndex: 0 }))).toEqual([
      "Rent",
      "Food",
      "Transport",
      "Old*",
    ]);
    expect(names(applyCategoryOp(cats(), { type: "move", id: "food", toIndex: 99 }))).toEqual([
      "Transport",
      "Rent",
      "Food",
      "Old*",
    ]);
  });

  it("archives to the end and restores to the end of the active list", () => {
    const archived = applyCategoryOp(cats(), { type: "archive", id: "food" });
    expect(names(archived)).toEqual(["Transport", "Rent", "Food*", "Old*"]);
    const restored = applyCategoryOp(archived, { type: "unarchive", id: "old" });
    expect(names(restored)).toEqual(["Transport", "Rent", "Old", "Food*"]);
    expect(restored.find((c) => c.id === "old")).not.toHaveProperty("archived");
  });

  it("never archives or deletes the last active category", () => {
    const one: LedgerCategory[] = [{ id: "only", name: "Only", order: 0 }];
    expect(applyCategoryOp(one, { type: "archive", id: "only" })).toEqual(one);
    expect(applyCategoryOp(one, { type: "delete", id: "only" })).toEqual(one);
  });

  it("deletes and ignores unknown ids", () => {
    expect(names(applyCategoryOp(cats(), { type: "delete", id: "old" }))).toEqual([
      "Food",
      "Transport",
      "Rent",
    ]);
    expect(applyCategoryOp(cats(), { type: "rename", id: "nope", name: "X" })).toEqual(
      normaliseOrder(cats()),
    );
  });
});

describe("applyCategoryOps — replaying onto a newer server copy", () => {
  it("keeps a concurrent change made by another member", () => {
    const mine = [
      { type: "rename", id: "food", name: "Eating out" },
      { type: "move", id: "rent", toIndex: 0 },
    ] as const;
    // Meanwhile someone else added "Gifts" and archived "transport".
    const server = applyCategoryOps(cats(), [
      { type: "add", id: "gifts", name: "Gifts" },
      { type: "archive", id: "transport" },
    ]);
    expect(names(applyCategoryOps(server, mine))).toEqual([
      "Rent",
      "Eating out",
      "Gifts",
      "Transport*",
      "Old*",
    ]);
  });

  it("skips my add when someone else already added the same name", () => {
    const server = applyCategoryOp(cats(), { type: "add", id: "gifts", name: "Gifts" });
    const result = applyCategoryOps(server, [{ type: "add", id: "gifts-2", name: "gifts" }]);
    expect(result.filter((c) => c.name.toLowerCase() === "gifts")).toHaveLength(1);
  });
});

describe("setBudget", () => {
  it("sets, updates and removes per-currency budgets", () => {
    let list = applyCategoryOp(cats(), {
      type: "setBudget",
      id: "food",
      currency: "JPY",
      amount: 30000,
    });
    list = applyCategoryOp(list, {
      type: "setBudget",
      id: "food",
      currency: "CAD",
      amount: 99.999,
    });
    expect(list[0].budget).toEqual({ JPY: 30000, CAD: 100 });
    list = applyCategoryOp(list, { type: "setBudget", id: "food", currency: "JPY", amount: 25000 });
    expect(list[0].budget).toEqual({ JPY: 25000, CAD: 100 });
    list = applyCategoryOp(list, { type: "setBudget", id: "food", currency: "JPY", amount: null });
    list = applyCategoryOp(list, { type: "setBudget", id: "food", currency: "CAD", amount: null });
    expect(list[0]).not.toHaveProperty("budget");
  });

  it("ignores invalid amounts, currencies and ids", () => {
    const base = normaliseOrder(cats());
    for (const amount of [0, -5, NaN, 2_000_000_000]) {
      expect(
        applyCategoryOp(cats(), { type: "setBudget", id: "food", currency: "JPY", amount }),
      ).toEqual(base);
    }
    expect(
      applyCategoryOp(cats(), {
        type: "setBudget",
        id: "food",
        currency: "XYZ" as never,
        amount: 5,
      }),
    ).toEqual(base);
    expect(
      applyCategoryOp(cats(), { type: "setBudget", id: "nope", currency: "JPY", amount: 5 }),
    ).toEqual(base);
  });

  it("survives replay alongside another member's rename", () => {
    const server = applyCategoryOp(cats(), { type: "rename", id: "food", name: "Eating out" });
    const result = applyCategoryOps(server, [
      { type: "setBudget", id: "food", currency: "JPY", amount: 20000 },
    ]);
    expect(result[0]).toMatchObject({ name: "Eating out", budget: { JPY: 20000 } });
  });
});
