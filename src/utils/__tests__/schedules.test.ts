import { describe, it, expect } from "vite-plus/test";
import {
  dayChoices,
  describeRepeat,
  formatDueDay,
  ordinal,
  scheduleFormError,
  schedulesByCategory,
  switchRepeat,
  withMonth,
} from "@/utils/schedules";
import { LedgerSchedule } from "@/types/ledger";

describe("schedules", () => {
  it("writes ordinals", () => {
    expect([1, 2, 3, 4, 11, 12, 13, 21, 22, 23, 31].map(ordinal)).toEqual([
      "1st",
      "2nd",
      "3rd",
      "4th",
      "11th",
      "12th",
      "13th",
      "21st",
      "22nd",
      "23rd",
      "31st",
    ]);
  });

  it("describes repeats and due days in lowercase", () => {
    expect(describeRepeat({ every: "month", day: 5 })).toBe("monthly · 5th");
    expect(describeRepeat({ every: "year", month: 3, day: 12 })).toBe("yearly · 12 mar");
    expect(formatDueDay("2026-12-05", "2026")).toBe("5 dec");
    expect(formatDueDay("2027-01-05", "2026")).toBe("5 jan 2027");
  });

  it("offers the days a repeat can fall on", () => {
    expect(dayChoices({ every: "month", day: 1 })).toHaveLength(31);
    expect(dayChoices({ every: "year", month: 2, day: 1 })).toHaveLength(29);
    expect(dayChoices({ every: "year", month: 4, day: 1 })).toHaveLength(30);
  });

  it("clamps the day when switching to yearly or another month", () => {
    expect(switchRepeat({ every: "month", day: 31 }, "year")).toEqual({
      every: "year",
      month: 1,
      day: 31,
    });
    expect(withMonth({ every: "year", month: 1, day: 31 }, 2)).toEqual({
      every: "year",
      month: 2,
      day: 29,
    });
    expect(switchRepeat({ every: "year", month: 2, day: 29 }, "month")).toEqual({
      every: "month",
      day: 29,
    });
  });

  it("checks the form", () => {
    const values = {
      label: "rent",
      amount: "1,200",
      currency: "CAD" as const,
      repeat: { every: "month" as const, day: 1 },
    };
    expect(scheduleFormError("housing", values)).toBeUndefined();
    expect(scheduleFormError("housing", { ...values, amount: "abc" })).toBe("enter an amount");
  });

  it("groups by category, by name", () => {
    const s = (id: string, categoryId: string, label: string) =>
      ({ id, categoryId, label }) as LedgerSchedule;
    const grouped = schedulesByCategory([
      s("1", "a", "rent"),
      s("2", "b", "gym"),
      s("3", "a", "insurance"),
    ]);
    expect(grouped.get("a")!.map((x) => x.label)).toEqual(["insurance", "rent"]);
    expect(grouped.get("b")!.map((x) => x.label)).toEqual(["gym"]);
  });
});
