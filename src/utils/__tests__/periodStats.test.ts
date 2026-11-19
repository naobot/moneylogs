import { describe, expect, it } from "vite-plus/test";

import { LedgerCategory, LedgerMonth } from "@/types/ledger";
import { BudgetSnapshot } from "@/utils/budgetHistory";
import { categoryBudgetRows } from "@/utils/ledgerStats";
import {
  aggregatePeriod,
  busiestMonth,
  periodBudget,
  periodCurrencies,
  vsPreviousPeriod,
} from "@/utils/periodStats";

type Doc = Pick<LedgerMonth, "totals" | "byCategory">;
const doc = (byCategory: Record<string, Record<string, number>>): Doc => {
  const totals: Record<string, number> = {};
  for (const amounts of Object.values(byCategory)) {
    for (const [c, n] of Object.entries(amounts)) totals[c] = (totals[c] ?? 0) + n;
  }
  return { totals, byCategory } as Doc;
};

const Q4 = ["2026-10", "2026-11", "2026-12"];
const Q3 = ["2026-07", "2026-08", "2026-09"];

const byMonth: Record<string, Doc> = {
  "2026-07": doc({ food: { CAD: 100 } }),
  "2026-08": doc({ food: { CAD: 200 } }),
  "2026-09": doc({ food: { CAD: 300 } }),
  "2026-10": doc({ food: { CAD: 350 }, fun: { CAD: 50, USD: 20 } }),
  "2026-11": doc({ food: { CAD: 150 } }),
};

const cats: LedgerCategory[] = [
  { id: "food", name: "Food", order: 0, budget: { CAD: 400 } },
  { id: "fun", name: "Fun", order: 1 },
];

describe("aggregatePeriod", () => {
  it("sums totals and categories over the months, skipping missing docs", () => {
    const agg = aggregatePeriod(Q4, byMonth);
    expect(agg.totals).toEqual({ CAD: 550, USD: 20 });
    expect(agg.byCategory).toEqual({ food: { CAD: 500 }, fun: { CAD: 50, USD: 20 } });
  });
});

describe("periodCurrencies", () => {
  it("orders currencies by the months they were used in", () => {
    expect(periodCurrencies(Q4, byMonth)).toEqual(["CAD", "USD"]);
    expect(periodCurrencies(["2027-01"], byMonth)).toEqual([]);
  });
});

describe("periodBudget", () => {
  it("sums the begun months' budgets, judging each month by its own", () => {
    // October had a 300 food budget; it rose to 400 in November.
    const snapshots: BudgetSnapshot[] = [
      { month: "2026-10", budgets: { food: { CAD: 300 } }, names: { food: "Food" } },
    ];
    const result = periodBudget({
      months: Q4,
      currentMonth: "2026-11",
      byMonth,
      categories: cats,
      snapshots,
      currency: "CAD",
    })!;
    expect(result.budget).toBe(700); // Oct 300 + Nov 400; December hasn't begun
    expect(result.spent).toBe(500); // food only: fun has no budget
    expect(result.months.map((m) => m.over)).toEqual([true, false]);
    expect({ within: result.within, finished: result.finished }).toEqual({
      within: 0,
      finished: 1,
    });

    const rows = categoryBudgetRows(aggregatePeriod(Q4, byMonth), "CAD", result.categories);
    expect(rows.find((r) => r.id === "food")).toMatchObject({ amount: 500, budget: 700 });
    expect(rows.find((r) => r.id === "fun")?.budget).toBeUndefined();
  });

  it("is null when no begun month had a budget in the currency", () => {
    expect(
      periodBudget({
        months: Q4,
        currentMonth: "2026-11",
        byMonth,
        categories: cats,
        snapshots: [],
        currency: "USD",
      }),
    ).toBeNull();
  });
});

describe("vsPreviousPeriod", () => {
  it("compares the same number of months so far", () => {
    // Oct + Nov (550) against Jul + Aug (300).
    expect(
      vsPreviousPeriod({
        months: Q4,
        previousMonths: Q3,
        currentMonth: "2026-11",
        byMonth,
        currency: "CAD",
      }),
    ).toEqual({ current: 550, previous: 300, change: 250 / 300 });
  });

  it("is null without anything to compare against", () => {
    expect(
      vsPreviousPeriod({
        months: Q3,
        previousMonths: ["2026-04", "2026-05", "2026-06"],
        currentMonth: "2026-11",
        byMonth,
        currency: "CAD",
      }),
    ).toBeNull();
  });
});

describe("busiestMonth", () => {
  it("finds the biggest month", () => {
    expect(busiestMonth(Q4, byMonth, "CAD")).toEqual({ month: "2026-10", amount: 400 });
    expect(busiestMonth(["2027-01"], byMonth, "CAD")).toBeNull();
  });
});
