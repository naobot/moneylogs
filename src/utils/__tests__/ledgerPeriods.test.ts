import { describe, expect, it } from "vite-plus/test";

import {
  formatPeriod,
  isValidPeriod,
  ledgerPeriodPath,
  monthWithin,
  parsePeriod,
  periodMonths,
  periodOf,
  periodSearchParams,
  shiftPeriod,
} from "@/utils/ledgerPeriods";

describe("periodOf", () => {
  it("finds the month, quarter and year of a day or month", () => {
    expect(periodOf("2026-11-19", "month")).toEqual({ kind: "month", key: "2026-11" });
    expect(periodOf("2026-11", "quarter")).toEqual({ kind: "quarter", key: "2026-Q4" });
    expect(periodOf("2026-03-31", "quarter")).toEqual({ kind: "quarter", key: "2026-Q1" });
    expect(periodOf("2026-04", "quarter")).toEqual({ kind: "quarter", key: "2026-Q2" });
    expect(periodOf("2026-07-01", "year")).toEqual({ kind: "year", key: "2026" });
  });
});

describe("periodMonths", () => {
  it("lists each period's months, oldest first", () => {
    expect(periodMonths({ kind: "month", key: "2026-11" })).toEqual(["2026-11"]);
    expect(periodMonths({ kind: "quarter", key: "2026-Q4" })).toEqual([
      "2026-10",
      "2026-11",
      "2026-12",
    ]);
    expect(periodMonths({ kind: "quarter", key: "2026-Q1" })[0]).toBe("2026-01");
    const year = periodMonths({ kind: "year", key: "2026" });
    expect(year).toHaveLength(12);
    expect(year[0]).toBe("2026-01");
    expect(year[11]).toBe("2026-12");
  });
});

describe("shiftPeriod", () => {
  it("steps by the period's own length, across year ends", () => {
    expect(shiftPeriod({ kind: "month", key: "2026-12" }, 1)).toEqual({
      kind: "month",
      key: "2027-01",
    });
    expect(shiftPeriod({ kind: "quarter", key: "2026-Q1" }, -1)).toEqual({
      kind: "quarter",
      key: "2025-Q4",
    });
    expect(shiftPeriod({ kind: "quarter", key: "2026-Q4" }, 1)).toEqual({
      kind: "quarter",
      key: "2027-Q1",
    });
    expect(shiftPeriod({ kind: "year", key: "2026" }, -2)).toEqual({ kind: "year", key: "2024" });
  });
});

describe("formatPeriod", () => {
  it("labels quarters and years", () => {
    expect(formatPeriod({ kind: "quarter", key: "2026-Q4" })).toBe("Q4 2026");
    expect(formatPeriod({ kind: "year", key: "2026" })).toBe("2026");
  });
});

describe("isValidPeriod", () => {
  it("rejects malformed keys", () => {
    expect(isValidPeriod({ kind: "quarter", key: "2026-Q5" })).toBe(false);
    expect(isValidPeriod({ kind: "quarter", key: "2026-Q0" })).toBe(false);
    expect(isValidPeriod({ kind: "year", key: "26" })).toBe(false);
    expect(isValidPeriod({ kind: "month", key: "2026-13" })).toBe(false);
  });
});

describe("monthWithin", () => {
  it("prefers the current month, else the period's last (or first, for future periods)", () => {
    expect(monthWithin({ kind: "quarter", key: "2026-Q4" }, "2026-11")).toBe("2026-11");
    expect(monthWithin({ kind: "quarter", key: "2026-Q2" }, "2026-11")).toBe("2026-06");
    expect(monthWithin({ kind: "year", key: "2027" }, "2026-11")).toBe("2027-01");
  });
});

describe("parsePeriod", () => {
  const params = (s: string) => new URLSearchParams(s);

  it("reads quarter, year or month params, defaulting to the current month", () => {
    expect(parsePeriod(params(""), "2026-11")).toEqual({ kind: "month", key: "2026-11" });
    expect(parsePeriod(params("month=2026-09"), "2026-11")).toEqual({
      kind: "month",
      key: "2026-09",
    });
    expect(parsePeriod(params("quarter=2026-Q3"), "2026-11")).toEqual({
      kind: "quarter",
      key: "2026-Q3",
    });
    expect(parsePeriod(params("year=2025"), "2026-11")).toEqual({ kind: "year", key: "2025" });
    expect(parsePeriod(params("quarter=junk"), "2026-11")).toEqual({
      kind: "month",
      key: "2026-11",
    });
  });

  it("keeps the entries view monthly", () => {
    expect(parsePeriod(params("quarter=2026-Q3"), "2026-11", "entries")).toEqual({
      kind: "month",
      key: "2026-09",
    });
  });
});

describe("periodSearchParams / ledgerPeriodPath", () => {
  it("drops the param for the current month only", () => {
    expect(periodSearchParams({ kind: "month", key: "2026-11" }, "2026-11")).toEqual({});
    expect(periodSearchParams({ kind: "quarter", key: "2026-Q4" }, "2026-11")).toEqual({
      quarter: "2026-Q4",
    });
  });

  it("builds stats and entries paths", () => {
    expect(ledgerPeriodPath("abc", "stats", { kind: "year", key: "2026" }, "2026-11")).toBe(
      "/l/abc/stats?year=2026",
    );
    expect(ledgerPeriodPath("abc", "entries", { kind: "year", key: "2026" }, "2026-11")).toBe(
      "/l/abc",
    );
    expect(ledgerPeriodPath("abc", "entries", { kind: "quarter", key: "2026-Q2" }, "2026-11")).toBe(
      "/l/abc?month=2026-06",
    );
  });
});
