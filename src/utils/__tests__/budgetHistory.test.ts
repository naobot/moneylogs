import { describe, expect, it } from "vite-plus/test";

import { LedgerCategory } from "@/types/ledger";
import {
  BudgetSnapshot,
  budgetsChanged,
  categoriesForMonth,
  effectiveBudgets,
  snapshotForMonth,
  snapshotOf,
  withSnapshotBudgets,
} from "@/utils/budgetHistory";
import { budgetsFor } from "@/utils/ledgerStats";

const cats: LedgerCategory[] = [
  { id: "food", name: "Food", order: 0, budget: { CAD: 400 } },
  { id: "rent", name: "Rent", order: 1, budget: { CAD: 1500, USD: 0 } },
  { id: "fun", name: "Fun", order: 2 },
  { id: "old", name: "Old", order: 3, archived: true, budget: { CAD: 50 } },
];

describe("effectiveBudgets", () => {
  it("keeps active categories' positive amounts only", () => {
    expect(effectiveBudgets(cats)).toEqual({ food: { CAD: 400 }, rent: { CAD: 1500 } });
  });
});

describe("budgetsChanged", () => {
  it("ignores edits that don't touch budgets", () => {
    const renamed = cats.map((c) => (c.id === "fun" ? { ...c, name: "Joy" } : c));
    expect(budgetsChanged(cats, renamed)).toBe(false);
  });

  it("sees amount changes, removals and archiving", () => {
    expect(
      budgetsChanged(
        cats,
        cats.map((c) => (c.id === "food" ? { ...c, budget: { CAD: 450 } } : c)),
      ),
    ).toBe(true);
    expect(
      budgetsChanged(
        cats,
        cats.map((c) => (c.id === "food" ? { ...c, budget: undefined } : c)),
      ),
    ).toBe(true);
    expect(
      budgetsChanged(
        cats,
        cats.map((c) => (c.id === "rent" ? { ...c, archived: true } : c)),
      ),
    ).toBe(true);
    expect(
      budgetsChanged(
        cats,
        cats.map((c) => (c.id === "fun" ? { ...c, budget: { CAD: 20 } } : c)),
      ),
    ).toBe(true);
  });
});

describe("snapshotForMonth", () => {
  const snaps: BudgetSnapshot[] = [
    { month: "2026-09", budgets: {}, names: {} },
    { month: "2026-06", budgets: {}, names: {} },
  ];

  it("picks the earliest snapshot at or after the month", () => {
    expect(snapshotForMonth("2026-03", snaps)?.month).toBe("2026-06");
    expect(snapshotForMonth("2026-06", snaps)?.month).toBe("2026-06");
    expect(snapshotForMonth("2026-07", snaps)?.month).toBe("2026-09");
    expect(snapshotForMonth("2026-10", snaps)).toBeUndefined();
    expect(snapshotForMonth("2026-10", [])).toBeUndefined();
  });
});

describe("withSnapshotBudgets", () => {
  it("swaps in the old budgets, reviving archived and deleted categories", () => {
    const snapshot = snapshotOf("2026-10", [
      { id: "food", name: "Food", order: 0, budget: { CAD: 300 } },
      { id: "old", name: "Old", order: 3, budget: { CAD: 50 } },
      { id: "gone", name: "Gone", order: 4, budget: { USD: 10 } },
    ]);
    const then = withSnapshotBudgets(cats, snapshot);
    expect(budgetsFor(then, "CAD")).toEqual({ total: 350, byCategory: { food: 300, old: 50 } });
    expect(budgetsFor(then, "USD")).toEqual({ total: 10, byCategory: { gone: 10 } });
    expect(then.find((c) => c.id === "gone")?.name).toBe("Gone");
    expect(then.find((c) => c.id === "rent")?.budget).toBeUndefined();
  });

  it("leaves categories alone without a snapshot", () => {
    expect(categoriesForMonth("2026-11", cats, [])).toEqual(cats);
  });
});
