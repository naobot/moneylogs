import { describe, expect, it } from "vite-plus/test";

import { LedgerCategory } from "@/types/ledger";
import { allocationOf, applyTotalOps, canEditTotal } from "@/utils/monthlyBudget";

const cats: LedgerCategory[] = [
  { id: "food", name: "Food", order: 0, budget: { CAD: 400 } },
  { id: "rent", name: "Rent", order: 1, budget: { CAD: 1500 } },
  { id: "old", name: "Old", order: 2, archived: true, budget: { CAD: 50 } },
];

describe("applyTotalOps", () => {
  it("sets, rounds and removes totals per currency", () => {
    expect(applyTotalOps(undefined, [{ currency: "CAD", amount: 2500.456 }])).toEqual({
      CAD: 2500.46,
    });
    expect(applyTotalOps({ CAD: 2500, USD: 40 }, [{ currency: "USD", amount: null }])).toEqual({
      CAD: 2500,
    });
    // Rounds to 0 at the cent, so it's ignored rather than saved as no budget.
    expect(applyTotalOps({ CAD: 2500 }, [{ currency: "CAD", amount: 0.004 }])).toEqual({
      CAD: 2500,
    });
  });

  it("ignores amounts that aren't valid budgets", () => {
    expect(applyTotalOps({ CAD: 2500 }, [{ currency: "CAD", amount: -1 }])).toEqual({ CAD: 2500 });
  });
});

describe("allocationOf", () => {
  it("shows what the categories leave over, or how far past the total they go", () => {
    expect(allocationOf(3000, cats, "CAD")).toEqual({
      allocated: 1900,
      unallocated: 1100,
      over: 0,
    });
    expect(allocationOf(1500, cats, "CAD")).toEqual({ allocated: 1900, unallocated: 0, over: 400 });
  });
});

describe("canEditTotal", () => {
  it("allows editing only on the current month", () => {
    expect(canEditTotal("2026-11", "2026-11-20")).toBe(true);
    expect(canEditTotal("2026-10", "2026-11-20")).toBe(false);
    expect(canEditTotal("2026-12", "2026-11-20")).toBe(false);
  });
});
