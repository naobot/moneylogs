import { describe, it, expect } from "vite-plus/test";
import {
  aggregateEntries,
  budgetsFor,
  budgetSummary,
  categoryBudgetRows,
  buildInsights,
  categoryShares,
  currenciesByUse,
  dailySeries,
  elapsedDays,
  inCategoryOrder,
  memberShares,
  monthlySeries,
  spentThroughDay,
} from "@/utils/ledgerStats";
import { LedgerCategory, LedgerEntry } from "@/types/ledger";

const CATS: LedgerCategory[] = [
  { id: "food", name: "Food", order: 0 },
  { id: "rent", name: "Rent", order: 1 },
];
const e = (amount: number, currency: string, categoryId: string, date: string, authorUid = "a") =>
  ({
    amount,
    currency,
    categoryId,
    date,
    authorUid,
    authorName: authorUid,
  }) as unknown as LedgerEntry;

describe("currenciesByUse", () => {
  it("orders by entry count, then the picker order", () => {
    expect(
      currenciesByUse([
        e(1, "CAD", "food", "2026-11-01"),
        e(1, "USD", "food", "2026-11-01"),
        e(1, "USD", "food", "2026-11-02"),
      ]),
    ).toEqual(["USD", "CAD"]);
    expect(
      currenciesByUse([e(1, "CAD", "food", "2026-11-01"), e(1, "JPY", "food", "2026-11-01")]),
    ).toEqual(["JPY", "CAD"]);
  });
});

describe("shares", () => {
  const agg = aggregateEntries([
    e(300, "JPY", "food", "2026-11-01", "alice"),
    e(100, "JPY", "rent", "2026-11-02", "bob"),
    e(5, "CAD", "rent", "2026-11-02", "bob"),
    e(50, "JPY", "gone", "2026-11-03", "carol"),
  ]);

  it("splits one currency by category, largest first, resolving unknown ids", () => {
    expect(categoryShares(agg, "JPY", CATS)).toEqual([
      { id: "food", name: "Food", amount: 300, share: 300 / 450 },
      { id: "rent", name: "Rent", amount: 100, share: 100 / 450 },
      { id: "gone", name: "Uncategorised", amount: 50, share: 50 / 450 },
    ]);
    expect(categoryShares(agg, "CAD", CATS)).toEqual([
      { id: "rent", name: "Rent", amount: 5, share: 1 },
    ]);
  });

  it("reorders rows to the category order, unknown ids last in input order", () => {
    const rows = [{ id: "x" }, { id: "rent" }, { id: "y" }, { id: "food" }];
    expect(inCategoryOrder(rows, CATS).map((r) => r.id)).toEqual(["food", "rent", "x", "y"]);
  });

  it("splits by member with a fallback name", () => {
    expect(memberShares(agg, "JPY", { alice: "Alice", bob: "Bob" }).map((s) => s.name)).toEqual([
      "Alice",
      "Bob",
      "Former member",
    ]);
  });
});

describe("elapsedDays", () => {
  it("counts days so far in the current month, all for past months, none for future", () => {
    expect(elapsedDays("2026-11", "2026-11-08")).toBe(8);
    expect(elapsedDays("2026-10", "2026-11-08")).toBe(31);
    expect(elapsedDays("2026-12", "2026-11-08")).toBe(0);
  });
});

describe("dailySeries", () => {
  it("zero-fills up to today with a running total", () => {
    const s = dailySeries(
      "2026-11",
      { "02": { JPY: 100 }, "03": { JPY: 50, CAD: 9 } },
      "JPY",
      "2026-11-04",
    );
    expect(s.map((p) => [p.key, p.amount, p.cumulative])).toEqual([
      ["2026-11-01", 0, 0],
      ["2026-11-02", 100, 100],
      ["2026-11-03", 50, 150],
      ["2026-11-04", 0, 150],
    ]);
  });

  it("shows the whole month for past and future months", () => {
    expect(dailySeries("2026-02", {}, "JPY", "2026-11-04")).toHaveLength(28);
    expect(dailySeries("2026-12", {}, "JPY", "2026-11-04")).toHaveLength(31);
  });
});

describe("monthlySeries", () => {
  it("treats missing months as zero", () => {
    const s = monthlySeries(
      ["2026-09", "2026-10", "2026-11"],
      { "2026-09": { JPY: 10 }, "2026-11": { JPY: 5, CAD: 1 } },
      "JPY",
    );
    expect(s.map((p) => [p.label, p.amount])).toEqual([
      ["Sep 2026", 10],
      ["Oct 2026", 0],
      ["Nov 2026", 5],
    ]);
  });
});

describe("buildInsights", () => {
  const agg = aggregateEntries([
    e(200, "JPY", "food", "2026-11-01"),
    e(100, "JPY", "rent", "2026-11-03"),
  ]);

  it("compares with the same point last month and counts days with nothing logged", () => {
    const insights = buildInsights({
      month: "2026-11",
      today: "2026-11-04",
      currency: "JPY",
      agg,
      previous: { byDay: { "01": { JPY: 100 }, "04": { JPY: 100 }, "20": { JPY: 9999 } } },
      categories: CATS,
    });
    expect(insights.topCategory?.name).toBe("Food");
    // 300 so far vs 200 by the 4th of last month (the 20th is excluded).
    expect(insights.vsLastMonth).toEqual({ current: 300, previous: 200, change: 0.5 });
    expect(insights.noSpendDays).toBe(2);
    expect(insights.elapsed).toBe(4);
  });

  it("has no comparison without last month's data, and caps at its length", () => {
    expect(
      buildInsights({
        month: "2026-11",
        today: "2026-11-04",
        currency: "JPY",
        agg,
        categories: CATS,
      }).vsLastMonth,
    ).toBeNull();
    // 31 March vs February (28 days): compare through the 28th.
    expect(spentThroughDay({ "28": { JPY: 5 }, "29": { JPY: 7 } }, "JPY", Math.min(31, 28))).toBe(
      5,
    );
  });
});

describe("budgets", () => {
  const BUDGETED: LedgerCategory[] = [
    { id: "food", name: "Food", order: 0, budget: { JPY: 30000, CAD: 200 } },
    { id: "rent", name: "Rent", order: 1, budget: { JPY: 100000 } },
    { id: "fun", name: "Fun", order: 2 },
    { id: "old", name: "Old", order: 3, archived: true, budget: { JPY: 999 } },
  ];
  const agg = aggregateEntries([
    e(36000, "JPY", "food", "2026-11-01"),
    e(50000, "JPY", "rent", "2026-11-02"),
    e(9999, "JPY", "fun", "2026-11-03"), // unbudgeted: not counted against the budget
  ]);

  it("sums active budgets per currency, ignoring archived categories", () => {
    expect(budgetsFor(BUDGETED, "JPY")).toEqual({
      total: 130000,
      byCategory: { food: 30000, rent: 100000 },
    });
    expect(budgetsFor(BUDGETED, "USD")).toEqual({ total: 0, byCategory: {} });
  });

  it("merges budgets into category rows, flags overruns, keeps unspent budgets", () => {
    const rows = categoryBudgetRows(
      aggregateEntries([e(36000, "JPY", "food", "2026-11-01")]),
      "JPY",
      BUDGETED,
    );
    expect(rows.map((r) => [r.name, r.amount, r.budget, r.over])).toEqual([
      ["Food", 36000, 30000, true],
      ["Rent", 0, 100000, false],
    ]);
  });

  it("lists category rows in the Categories panel order, not by amount", () => {
    const rows = categoryBudgetRows(
      aggregateEntries([
        e(9999, "JPY", "fun", "2026-11-01"),
        e(50, "JPY", "gone", "2026-11-01"),
        e(36000, "JPY", "food", "2026-11-02"),
      ]),
      "JPY",
      BUDGETED,
    );
    expect(rows.map((r) => r.name)).toEqual(["Food", "Rent", "Fun", "Uncategorised"]);
  });

  it("summarises the month with pace, allowance and projection", () => {
    const s = budgetSummary({
      month: "2026-11",
      today: "2026-11-10",
      currency: "JPY",
      agg,
      categories: BUDGETED,
    })!;
    expect(s).toMatchObject({
      budget: 130000,
      spent: 86000,
      remaining: 44000,
      over: false,
      daysLeft: 21,
    });
    expect(s.used).toBeCloseTo(86000 / 130000);
    expect(s.perDayLeft).toBe(Math.round((44000 / 21) * 100) / 100);
    expect(s.projected).toBe(258000); // 86,000 over 10 days, 30-day month
  });

  it("has no pace figures for past months and reports overspend", () => {
    const s = budgetSummary({
      month: "2026-11",
      today: "2026-12-05",
      currency: "JPY",
      agg: aggregateEntries([e(140000, "JPY", "rent", "2026-11-02")]),
      categories: BUDGETED,
    })!;
    expect(s).toMatchObject({
      remaining: -10000,
      over: true,
      daysLeft: null,
      perDayLeft: null,
      projected: null,
    });
  });

  it("returns null when nothing is budgeted in the currency", () => {
    expect(
      budgetSummary({
        month: "2026-11",
        today: "2026-11-10",
        currency: "USD",
        agg,
        categories: BUDGETED,
      }),
    ).toBeNull();
  });
});
