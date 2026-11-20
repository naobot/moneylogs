import { describe, it, expect } from "vite-plus/test";
import {
  budgetAlerts,
  elapsedDays,
  isCurrentMonth,
  budgetPace,
  budgetPaceRatio,
  historyPaceRatio,
  isFixedCategory,
  budgetLines,
  UNALLOCATED,
} from "./ledgerBudget";

const at = (iso: string) => new Date(iso).getTime();

const categories = [
  { id: "food", name: "Food", budget: { CAD: 500, JPY: 50000 } },
  { id: "fun", name: "Fun", budget: { CAD: 500 } },
  { id: "old", name: "Old", archived: true, budget: { CAD: 1000 } },
  { id: "misc", name: "Misc" },
];

const alertsFor = (
  byCategory: Record<string, Record<string, number>>,
  now = at("2026-11-03T12:00:00Z"),
  month = "2026-11",
) =>
  budgetAlerts({
    ledgerId: "l1",
    ledgerName: "Household",
    month,
    categories,
    byCategory,
    now,
  });

const ids = (alerts: ReturnType<typeof alertsFor>) => alerts.map((a) => a.id).sort();

describe("isCurrentMonth / elapsedDays", () => {
  it("counts a month as current anywhere on Earth", () => {
    expect(isCurrentMonth("2026-11", at("2026-11-15T00:00:00Z"))).toBe(true);
    // 1 Dec 05:00 UTC is still 30 Nov in UTC-12.
    expect(isCurrentMonth("2026-11", at("2026-12-01T05:00:00Z"))).toBe(true);
    // 30 Nov 13:00 UTC is already 1 Dec in UTC+14.
    expect(isCurrentMonth("2026-12", at("2026-11-30T13:00:00Z"))).toBe(true);
    expect(isCurrentMonth("2026-10", at("2026-11-15T00:00:00Z"))).toBe(false);
  });

  it("counts elapsed days including today", () => {
    expect(elapsedDays("2026-11", at("2026-11-03T12:00:00Z"))).toBe(3);
    expect(elapsedDays("2026-11", at("2026-12-01T05:00:00Z"))).toBe(30);
    expect(elapsedDays("2026-12", at("2026-11-30T13:00:00Z"))).toBe(1);
  });
});

describe("budgetAlerts", () => {
  it("is quiet under 80%", () => {
    expect(alertsFor({ food: { CAD: 100 }, fun: { CAD: 100 } })).toEqual([]);
  });

  it("warns at 80% of the total, and per category", () => {
    const alerts = alertsFor({ food: { CAD: 450 }, fun: { CAD: 350 } });
    expect(ids(alerts)).toEqual([
      "budget_approaching_l1_2026-11_CAD",
      "budget_approaching_l1_2026-11_CAD_food",
    ]);
    const total = alerts.find((a) => !a.categoryScoped)!;
    expect(total.data).toEqual({
      type: "budget_approaching",
      groupId: "l1",
      groupName: "Household",
      logKind: "ledger",
      month: "2026-11",
      currency: "CAD",
      spent: 800,
      budget: 1000,
    });
    const food = alerts.find((a) => a.categoryScoped)!;
    expect(food.data).toMatchObject({ categoryId: "food", categoryName: "Food", budget: 500 });
  });

  it("says exceeded rather than approaching when an entry jumps past both", () => {
    const alerts = alertsFor({ food: { CAD: 1200 } });
    expect(ids(alerts)).toEqual([
      "budget_exceeded_l1_2026-11_CAD",
      "budget_exceeded_l1_2026-11_CAD_food",
    ]);
  });

  it("keeps currencies apart and ignores archived categories and unbudgeted spend", () => {
    const alerts = alertsFor({
      food: { JPY: 45000 },
      old: { CAD: 5000 },
      misc: { CAD: 5000 },
    });
    expect(ids(alerts)).toEqual([
      "budget_approaching_l1_2026-11_JPY",
      "budget_approaching_l1_2026-11_JPY_food",
    ]);
  });

  it("projects the total from day 7, in two slots a month", () => {
    // 300 of 1000 by day 7 → about 1,286 by the 30th.
    const early = alertsFor({ food: { CAD: 300 } }, at("2026-11-07T12:00:00Z"));
    expect(ids(early)).toEqual(["budget_projected_l1_2026-11_CAD_1"]);
    expect(early[0].data).toMatchObject({ spent: 300, budget: 1000, projected: 1285.71 });

    // 600 of 1000 by day 16 → about 1,125, with neither category at 80% yet.
    const late = alertsFor({ food: { CAD: 300 }, fun: { CAD: 300 } }, at("2026-11-16T12:00:00Z"));
    expect(ids(late)).toEqual(["budget_projected_l1_2026-11_CAD_2"]);
  });

  it("doesn't project in the first days, on pace, or once over", () => {
    expect(alertsFor({ food: { CAD: 300 } }, at("2026-11-06T12:00:00Z"))).toEqual([]);
    expect(alertsFor({ food: { CAD: 200 } }, at("2026-11-10T12:00:00Z"))).toEqual([]);
    const over = alertsFor({ food: { CAD: 600 }, fun: { CAD: 600 } }, at("2026-11-10T12:00:00Z"));
    expect(ids(over).some((id) => id.startsWith("budget_projected"))).toBe(false);
  });

  it("never alerts on a past month", () => {
    expect(alertsFor({ food: { CAD: 5000 } }, at("2026-12-15T00:00:00Z"))).toEqual([]);
  });
});

describe("budgetPaceRatio", () => {
  // Nov 15 of 30 days: half of each budget is the pace.
  const ratio = (byCategory: Record<string, Record<string, number>>, cats = categories) =>
    budgetPaceRatio({
      categories: cats,
      byCategory,
      month: "2026-11",
      now: at("2026-11-15T12:00:00Z"),
    });

  it("is 1 right on pace, and less under it", () => {
    expect(ratio({ food: { CAD: 300, JPY: 25000 }, fun: { CAD: 200 } })).toBe(1);
    expect(ratio({ food: { CAD: 250, JPY: 12500 } })).toBe(0.5);
    expect(ratio({})).toBe(0);
  });

  it("takes the worst budgeted currency", () => {
    expect(ratio({ food: { CAD: 100, JPY: 50000 } })).toBe(2);
  });

  it("ignores unbudgeted spending, and is null without budgets", () => {
    expect(ratio({ misc: { CAD: 99999 } })).toBe(0);
    expect(ratio({}, [{ id: "misc", name: "Misc" }])).toBeNull();
  });
});

describe("historyPaceRatio", () => {
  // Nov 15 of 30 days: half an average month is the pace.
  const ratio = (
    totals: Record<string, number>,
    history: Array<Record<string, number> | undefined>,
  ) => historyPaceRatio({ totals, history, month: "2026-11", now: at("2026-11-15T12:00:00Z") });

  it("compares this month so far with an average recent month", () => {
    const history = [{ CAD: 1000 }, { CAD: 600 }, { CAD: 800 }]; // usual: 800
    expect(ratio({ CAD: 400 }, history)).toBe(1);
    expect(ratio({ CAD: 200 }, history)).toBe(0.5);
    expect(ratio({ CAD: 800 }, history)).toBe(2);
  });

  it("averages over the months with spending only", () => {
    expect(ratio({ CAD: 300 }, [{ CAD: 600 }, undefined, { CAD: 600 }])).toBe(1);
    expect(ratio({ CAD: 300 }, [{ CAD: 600 }, {}, { CAD: 600 }])).toBe(1);
  });

  it("needs at least two months of history", () => {
    expect(ratio({ CAD: 1 }, [{ CAD: 600 }, undefined, undefined])).toBeNull();
    expect(ratio({ CAD: 1 }, [])).toBeNull();
  });

  it("takes the worst currency with history, and leaves new currencies out", () => {
    const history = [
      { CAD: 600, JPY: 60000 },
      { CAD: 600, JPY: 60000 },
    ];
    expect(ratio({ CAD: 150, JPY: 45000 }, history)).toBe(1.5);
    expect(ratio({ CAD: 150, EUR: 9999 }, history)).toBe(0.5);
  });
});

describe("fixed costs", () => {
  const withRent = [
    { id: "food", name: "Food", budget: { CAD: 600 } },
    { id: "housing", name: "Housing", budget: { CAD: 1500 } }, // fixed by default
    { id: "phone", name: "Phone", fixed: true, budget: { CAD: 100 } },
  ];

  it("defaults housing and utilities to fixed, and an explicit flag wins", () => {
    expect(isFixedCategory({ id: "housing" })).toBe(true);
    expect(isFixedCategory({ id: "utilities" })).toBe(true);
    expect(isFixedCategory({ id: "food" })).toBe(false);
    expect(isFixedCategory({ id: "housing", fixed: false })).toBe(false);
    expect(isFixedCategory({ id: "phone", fixed: true })).toBe(true);
  });

  it("doesn't project rent paid on the 1st as a spree", () => {
    const alerts = budgetAlerts({
      ledgerId: "l1",
      ledgerName: "Household",
      month: "2026-11",
      categories: withRent,
      byCategory: { housing: { CAD: 1500 }, phone: { CAD: 100 }, food: { CAD: 100 } },
      now: at("2026-11-07T12:00:00Z"),
    });
    // Housing at 100% of its own budget still warns, but there's no projection.
    expect(alerts.some((a) => a.data.type === "budget_projected")).toBe(false);
  });

  it("projects fixed costs at their budget, and everyday spending at pace", () => {
    const pace = budgetPace({
      budgets: [
        ["food", 600],
        ["housing", 1500],
        ["phone", 100],
      ],
      isFixed: (id) => id !== "food",
      spentIn: (id) => ({ food: 300, phone: 120 })[id] ?? 0,
      elapsed: 10,
      days: 30,
    });
    expect(pace).toMatchObject({
      budget: 2200,
      spent: 420,
      flexibleBudget: 600,
      flexibleSpent: 300,
      // 1500 (rent not paid yet) + 120 (phone ran over) + 300 × 3.
      projected: 2520,
    });
    expect(pace.pace).toBeCloseTo(1.5);
  });

  it("leaves fixed costs out of the find pace, and is null with only those budgeted", () => {
    const ratio = (cats: typeof withRent) =>
      budgetPaceRatio({
        categories: cats,
        byCategory: { housing: { CAD: 1500 }, food: { CAD: 300 } },
        month: "2026-11",
        now: at("2026-11-15T12:00:00Z"),
      });
    expect(ratio(withRent)).toBe(1);
    expect(ratio(withRent.filter((c) => c.id === "housing"))).toBeNull();
  });
});

describe("monthly totals", () => {
  const byCategory = { food: { CAD: 300 }, misc: { CAD: 250 }, fun: { USD: 40 } };

  it("measures all spending against the total, the rest as one everyday line", () => {
    const { lines, spentIn, budget } = budgetLines({
      budgets: [["food", 400]],
      total: 1000,
      byCategory,
      currency: "CAD",
    });
    expect(budget).toBe(1000);
    expect([...lines]).toEqual([
      ["food", 400],
      [UNALLOCATED, 600],
    ]);
    expect(spentIn(UNALLOCATED)).toBe(250); // misc has no budget
    expect(spentIn("food")).toBe(300);
  });

  it("keeps the categories' sum without a total, and leaves nothing unallocated when over", () => {
    expect(
      budgetLines({ budgets: [["food", 400]], total: null, byCategory, currency: "CAD" }).budget,
    ).toBe(400);
    const over = budgetLines({ budgets: [["food", 400]], total: 300, byCategory, currency: "CAD" });
    expect(over.budget).toBe(300);
    expect(over.lines.get(UNALLOCATED)).toBe(0);
  });

  it("alerts on the total, including a currency budgeted only by a total", () => {
    const alerts = budgetAlerts({
      ledgerId: "l1",
      ledgerName: "Household",
      month: "2026-11",
      categories,
      totals: { CAD: 2000, USD: 45 },
      byCategory: { misc: { CAD: 1700 }, fun: { USD: 40 } },
      now: at("2026-11-03T12:00:00Z"),
    });
    const total = (currency: string) =>
      alerts.find((a) => !a.categoryScoped && a.data.currency === currency)?.data;
    // Misc has no budget, but counts against the 2,000 total.
    expect(total("CAD")).toMatchObject({ type: "budget_approaching", spent: 1700, budget: 2000 });
    expect(total("USD")).toMatchObject({ type: "budget_approaching", spent: 40, budget: 45 });
  });

  it("paces unbudgeted spending against the unallocated part", () => {
    const ratio = budgetPaceRatio({
      categories: [],
      totals: { CAD: 3000 },
      byCategory: { misc: { CAD: 1000 } },
      month: "2026-11",
      now: at("2026-11-10T12:00:00Z"),
    });
    expect(ratio).toBeCloseTo(1000 / (3000 * (10 / 30)));
  });
});
