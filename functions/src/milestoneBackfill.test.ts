import { describe, it, expect } from "vite-plus/test";
import { longestRun, markerDays, planBackfill, PastActivity } from "./milestoneBackfill";

const days = (from: string, n: number) =>
  Array.from({ length: n }, (_, i) =>
    new Date(Date.parse(`${from}T00:00:00Z`) + i * 86_400_000).toISOString().slice(0, 10),
  );

const none: PastActivity = {
  entryDays: [],
  wroteSocialEntry: false,
  commentedOnOthers: false,
  hasFriend: false,
};

describe("milestone backfill", () => {
  it("finds the longest run of days, across months", () => {
    expect(longestRun([])).toBe(0);
    expect(longestRun(["2026-10-30", "2026-10-31", "2026-11-01", "2026-11-03"])).toBe(3);
    expect(longestRun(days("2026-01-01", 12))).toBe(12);
  });

  it("lists a marker's days", () => {
    expect(markerDays({ lastDay: "2026-11-02", days: 3 })).toEqual([
      "2026-11-02",
      "2026-11-01",
      "2026-10-31",
    ]);
    expect(markerDays(undefined)).toEqual([]);
  });

  it("gives nothing to someone who hasn't done anything", () => {
    expect(planBackfill({ activity: none, held: new Set(), marker: undefined })).toEqual({
      items: [],
      marker: null,
    });
  });

  it("gives the one-offs for past social activity", () => {
    const plan = planBackfill({
      activity: { ...none, wroteSocialEntry: true, commentedOnOthers: true, hasFriend: true },
      held: new Set(),
      marker: undefined,
    });
    expect(plan.items).toEqual(["heart_leaf", "paper_crane", "friendship_bracelet"]);
    expect(plan.marker).toBeNull();
  });

  it("gives copper and the streak coins from days with entries", () => {
    const plan = planBackfill({
      activity: { ...none, entryDays: [...days("2026-09-01", 31), "2026-11-10"] },
      held: new Set(),
      marker: undefined,
    });
    expect(plan.items).toEqual(["copper_coin", "silver_coin", "gold_coin"]);
    // The streak carries on from the last day with an entry.
    expect(plan.marker).toEqual({
      lastDay: "2026-11-10",
      days: 1,
      coins: ["copper_coin", "silver_coin", "gold_coin"],
    });
  });

  it("skips what they already hold", () => {
    const plan = planBackfill({
      activity: { ...none, entryDays: days("2026-09-01", 10), hasFriend: true },
      held: new Set(["copper_coin", "friendship_bracelet"]),
      marker: { lastDay: "2026-11-10", days: 1, coins: ["copper_coin"] },
    });
    expect(plan.items).toEqual(["silver_coin"]);
  });

  it("joins past entry days onto a streak that's still going", () => {
    // Checked in on the 16th and 17th since launch; logged entries the 8 days before.
    const plan = planBackfill({
      activity: { ...none, entryDays: days("2026-11-08", 8) },
      held: new Set(),
      marker: { lastDay: "2026-11-17", days: 2, coins: [] },
    });
    expect(plan.items).toEqual(["copper_coin", "silver_coin"]);
    expect(plan.marker).toEqual({
      lastDay: "2026-11-17",
      days: 10,
      coins: ["copper_coin", "silver_coin"],
    });
  });

  it("leaves an unchanged marker alone", () => {
    const marker = { lastDay: "2026-11-17", days: 2, coins: ["copper_coin"] };
    expect(
      planBackfill({
        activity: { ...none, entryDays: ["2026-11-17"] },
        held: new Set(["copper_coin"]),
        marker,
      }),
    ).toEqual({ items: [], marker: null });
  });
});
