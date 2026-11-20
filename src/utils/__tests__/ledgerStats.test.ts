import { describe, it, expect } from "vite-plus/test";
import {
  aggregateEntries,
  budgetsFor,
  budgetSummary,
  categoryBudgetRows,
  buildInsights,
  categoryBarSegments,
  categoryShares,
  currenciesByUse,
  dailySeries,
  elapsedDays,
  inCategoryOrder,
  memberShares,
  monthElapsedShare,
  monthlySeries,
  sortCategoryRows,
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

  it("sets fixed costs aside for pace, allowance and projection", () => {
    const categories: LedgerCategory[] = [
      { id: "food", name: "Food", order: 0, budget: { JPY: 60000 } },
      { id: "housing", name: "Housing", order: 1, budget: { JPY: 100000 } },
    ];
    const s = budgetSummary({
      month: "2026-11",
      today: "2026-11-10",
      currency: "JPY",
      agg: aggregateEntries([
        e(100000, "JPY", "housing", "2026-11-01"),
        e(10000, "JPY", "food", "2026-11-05"),
      ]),
      categories,
    })!;
    // Totals still include rent; pace and projection treat it as committed.
    expect(s).toMatchObject({ budget: 160000, spent: 110000, remaining: 50000, over: false });
    expect(s.projected).toBe(130000); // 100,000 + 10,000 × 3
    expect(s.pace).toBeCloseTo(0.5); // 10,000 of a third of 60,000
    expect(s.perDayLeft).toBe(Math.round((50000 / 21) * 100) / 100);
  });

  it("keeps the everyday allowance to what's left of everyday budgets", () => {
    const categories: LedgerCategory[] = [
      { id: "food", name: "Food", order: 0, budget: { JPY: 60000 } },
      { id: "housing", name: "Housing", order: 1, budget: { JPY: 100000 } },
    ];
    // Rent not logged yet: the 100,000 left for it isn't everyday money.
    const s = budgetSummary({
      month: "2026-11",
      today: "2026-11-10",
      currency: "JPY",
      agg: aggregateEntries([e(18000, "JPY", "food", "2026-11-05")]),
      categories,
    })!;
    expect(s.perDayLeft).toBe(2000); // 42,000 over 21 days
    expect(s.projected).toBe(154000);
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

  it("measures all spending against a monthly total", () => {
    const s = budgetSummary({
      month: "2026-11",
      today: "2026-11-10",
      currency: "JPY",
      agg: aggregateEntries([
        e(30000, "JPY", "food", "2026-11-02"),
        e(20000, "JPY", "gone", "2026-11-03"),
      ]),
      categories: [{ id: "food", name: "Food", order: 0, budget: { JPY: 60000 } }],
      totals: { JPY: 200000, CAD: 1000 },
    })!;
    expect(s).toMatchObject({
      budget: 200000,
      spent: 50000, // the unbudgeted 20,000 counts too
      remaining: 150000,
      isTotal: true,
      allocated: 60000,
    });
    expect(s.projected).toBe(150000);
  });

  it("budgets by a monthly total alone", () => {
    const s = budgetSummary({
      month: "2026-11",
      today: "2026-11-10",
      currency: "JPY",
      agg: aggregateEntries([e(1000, "JPY", "food", "2026-11-02")]),
      categories: [],
      totals: { JPY: 30000 },
    });
    expect(s).toMatchObject({ budget: 30000, spent: 1000, isTotal: true, allocated: 0 });
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

describe("categoryBarSegments", () => {
  const cats: LedgerCategory[] = ["a", "b", "c", "d", "e", "f"].map((id, order) => ({
    id,
    name: id.toUpperCase(),
    order,
  }));
  // Largest first, as categoryShares returns them.
  const shares = [
    { id: "d", name: "D", amount: 40, share: 0.4 },
    { id: "b", name: "B", amount: 25, share: 0.25 },
    { id: "f", name: "F", amount: 15, share: 0.15 },
    { id: "a", name: "A", amount: 10, share: 0.1 },
    { id: "c", name: "C", amount: 6, share: 0.06 },
    { id: "e", name: "E", amount: 4, share: 0.04 },
  ];

  it("draws the four largest in category order and groups the rest", () => {
    const { top, rest } = categoryBarSegments(shares, cats);
    expect(top.map((s) => s.id)).toEqual(["a", "b", "d", "f"]);
    expect(rest).toBeCloseTo(0.1);
  });

  it("maps each category to its segment fill", () => {
    const { segmentOf } = categoryBarSegments(shares, cats);
    expect(Object.fromEntries(segmentOf)).toEqual({
      a: 0,
      b: 1,
      d: 2,
      f: 3,
      c: "rest",
      e: "rest",
    });
  });

  it("has no rest when there are four or fewer categories", () => {
    const { top, rest, segmentOf } = categoryBarSegments(shares.slice(0, 2), cats);
    expect(top.map((s) => s.id)).toEqual(["b", "d"]);
    expect(rest).toBe(0);
    expect(segmentOf.size).toBe(2);
  });
});

describe("sortCategoryRows", () => {
  const CATS: LedgerCategory[] = [
    { id: "food", name: "Food", order: 0, budget: { JPY: 30000 } },
    { id: "rent", name: "Rent", order: 1, budget: { JPY: 100000 }, fixed: true },
    { id: "fun", name: "Fun", order: 2, budget: { JPY: 10000 } },
    { id: "misc", name: "Misc", order: 3 },
    { id: "gifts", name: "Gifts", order: 4 },
  ];
  // Ten days into a 30-day month.
  const rows = categoryBudgetRows(
    aggregateEntries([
      e(15000, "JPY", "food", "2026-11-01"), // 50% used, a third through: 1.5x
      e(100000, "JPY", "rent", "2026-11-01"), // fixed, paid in full: 1x
      e(2000, "JPY", "fun", "2026-11-02"), // 20% used: 0.6x
      e(500, "JPY", "misc", "2026-11-03"),
      e(8000, "JPY", "gifts", "2026-11-04"),
    ]),
    "JPY",
    CATS,
  );
  const opts = { categories: CATS, elapsedShare: monthElapsedShare("2026-11", "2026-11-10") };
  const ids = (sort: "order" | "amount" | "pace") =>
    sortCategoryRows(rows, sort, opts).map((r) => r.id);

  it("keeps the Categories panel order by default", () => {
    expect(ids("order")).toEqual(["food", "rent", "fun", "misc", "gifts"]);
  });

  it("sorts by amount, most first", () => {
    expect(ids("amount")).toEqual(["rent", "food", "gifts", "fun", "misc"]);
  });

  it("sorts budgets by pace, fastest first, then unbudgeted rows by amount", () => {
    expect(ids("pace")).toEqual(["food", "rent", "fun", "gifts", "misc"]);
    const pace = Object.fromEntries(
      sortCategoryRows(rows, "pace", opts).map((r) => [r.id, r.pace]),
    );
    expect(pace.food).toBeCloseTo(1.5);
    expect(pace.rent).toBe(1);
    expect(pace.fun).toBeCloseTo(0.6);
    expect(pace.misc).toBeUndefined();
  });

  it("judges a finished month (or no elapsed time) by share used", () => {
    const done = sortCategoryRows(rows, "pace", { categories: CATS, elapsedShare: 1 });
    expect(done.find((r) => r.id === "food")?.pace).toBeCloseTo(0.5);
    const future = sortCategoryRows(rows, "pace", { categories: CATS, elapsedShare: 0 });
    expect(future.find((r) => r.id === "food")?.pace).toBeCloseTo(0.5);
  });

  it("measures how much of a month has gone by", () => {
    expect(monthElapsedShare("2026-11", "2026-11-15")).toBeCloseTo(0.5);
    expect(monthElapsedShare("2026-10", "2026-11-15")).toBe(1);
    expect(monthElapsedShare("2026-12", "2026-11-15")).toBe(0);
  });
});
