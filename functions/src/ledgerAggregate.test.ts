import { describe, it, expect } from "vite-plus/test";
import { affectedMonths, aggregateFieldsChanged, aggregateMonth } from "./ledgerAggregate";

const e = (
  amount: number,
  currency: string,
  categoryId: string,
  authorUid: string,
  date: string,
) => ({
  amount,
  currency,
  categoryId,
  authorUid,
  date,
});

describe("aggregateMonth", () => {
  it("totals by currency, category, member and day without converting currencies", () => {
    const agg = aggregateMonth([
      e(1200, "JPY", "food", "alice", "2026-11-01"),
      e(800, "JPY", "food", "bob", "2026-11-01"),
      e(3.5, "CAD", "transport", "alice", "2026-11-08"),
    ]);
    expect(agg).toEqual({
      entryCount: 3,
      totals: { JPY: 2000, CAD: 3.5 },
      byCategory: { food: { JPY: 2000 }, transport: { CAD: 3.5 } },
      byMember: { alice: { JPY: 1200, CAD: 3.5 }, bob: { JPY: 800 } },
      byDay: { "01": { JPY: 2000 }, "08": { CAD: 3.5 } },
    });
  });

  it("rounds away floating-point noise", () => {
    const agg = aggregateMonth([
      e(0.1, "CAD", "a", "u", "2026-11-01"),
      e(0.2, "CAD", "a", "u", "2026-11-01"),
    ]);
    expect(agg.totals.CAD).toBe(0.3);
  });

  it("ignores malformed entries", () => {
    const agg = aggregateMonth([
      e(5, "CAD", "a", "u", "2026-11-01"),
      { amount: -1, currency: "CAD", categoryId: "a", authorUid: "u", date: "2026-11-01" },
      { amount: 5, currency: "CAD", categoryId: "a", authorUid: "u", date: "nope" },
      { amount: 5 },
    ]);
    expect(agg.entryCount).toBe(1);
  });

  it("returns an empty aggregate for no entries", () => {
    expect(aggregateMonth([])).toEqual({
      entryCount: 0,
      totals: {},
      byCategory: {},
      byMember: {},
      byDay: {},
    });
  });
});

describe("aggregateFieldsChanged", () => {
  const base = e(5, "CAD", "food", "u", "2026-11-01");
  it("skips note-only edits", () => {
    expect(
      aggregateFieldsChanged({ ...base, note: "a" } as never, { ...base, note: "b" } as never),
    ).toBe(false);
  });
  it("recomputes on creates, deletes and relevant edits", () => {
    expect(aggregateFieldsChanged(undefined, base)).toBe(true);
    expect(aggregateFieldsChanged(base, undefined)).toBe(true);
    expect(aggregateFieldsChanged(base, { ...base, amount: 6 })).toBe(true);
    expect(aggregateFieldsChanged(base, { ...base, categoryId: "x" })).toBe(true);
    expect(aggregateFieldsChanged(base, { ...base, date: "2026-11-02" })).toBe(true);
  });
});

describe("affectedMonths", () => {
  it("includes both months when an edit moves an entry", () => {
    expect(affectedMonths({ month: "2026-10" }, { month: "2026-11" })).toEqual([
      "2026-10",
      "2026-11",
    ]);
    expect(affectedMonths({ month: "2026-11" }, { month: "2026-11" })).toEqual(["2026-11"]);
    expect(affectedMonths(undefined, { month: "2026-11" })).toEqual(["2026-11"]);
    expect(affectedMonths({ month: "bad" }, undefined)).toEqual([]);
  });
});
