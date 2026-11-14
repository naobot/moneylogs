import { describe, it, expect } from "vite-plus/test";
import { budgetAlerts, elapsedDays, isCurrentMonth, onBudgetPace } from "./ledgerBudget";

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

describe("onBudgetPace", () => {
  // Nov 15 of 30 days: half of each budget is the pace.
  const pace = (byCategory: Record<string, Record<string, number>>, cats = categories) =>
    onBudgetPace({
      categories: cats,
      byCategory,
      month: "2026-11",
      now: at("2026-11-15T12:00:00Z"),
    });

  it("is on pace at or under the budget's share of the month so far", () => {
    expect(pace({ food: { CAD: 300, JPY: 25000 }, fun: { CAD: 200 } })).toBe(true);
    expect(pace({ food: { CAD: 500, JPY: 0 } })).toBe(true);
  });

  it("is off pace when any budgeted currency runs ahead", () => {
    expect(pace({ food: { CAD: 100, JPY: 30000 } })).toBe(false);
    expect(pace({ food: { CAD: 400 }, fun: { CAD: 200 } })).toBe(false);
  });

  it("ignores unbudgeted spending, and is never on pace without budgets", () => {
    expect(pace({ misc: { CAD: 99999 } })).toBe(true);
    expect(pace({}, [{ id: "misc", name: "Misc" }])).toBe(false);
  });
});
