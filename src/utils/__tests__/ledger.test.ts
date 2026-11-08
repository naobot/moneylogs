import { describe, it, expect } from "vite-plus/test";
import {
  DEFAULT_CATEGORIES,
  activeCategories,
  formatMonth,
  isValidDateKey,
  isValidMonthKey,
  monthKeyOf,
  normaliseCategoryName,
  resolveCategory,
  shiftMonth,
  todayInTz,
  trailingMonths,
  validateEntry,
} from "@/utils/ledger";
import { isCurrency } from "@/utils/currency";
import { LedgerCategory } from "@/types/ledger";

const CATS: LedgerCategory[] = [
  { id: "b", name: "Bravo", order: 2 },
  { id: "a", name: "Alpha", order: 1 },
  { id: "z", name: "Zulu", order: 0, archived: true },
];

describe("date and month keys", () => {
  it("validates real calendar dates only", () => {
    expect(isValidDateKey("2026-11-08")).toBe(true);
    expect(isValidDateKey("2024-02-29")).toBe(true);
    expect(isValidDateKey("2026-02-29")).toBe(false);
    expect(isValidDateKey("2026-13-01")).toBe(false);
    expect(isValidDateKey("2026-1-01")).toBe(false);
    expect(isValidDateKey("")).toBe(false);
  });

  it("validates month keys", () => {
    expect(isValidMonthKey("2026-11")).toBe(true);
    expect(isValidMonthKey("2026-00")).toBe(false);
    expect(isValidMonthKey("2026-11-01")).toBe(false);
  });

  it("derives the month from a date", () => {
    expect(monthKeyOf("2026-11-08")).toBe("2026-11");
  });

  it("shifts months across year boundaries", () => {
    expect(shiftMonth("2026-01", -1)).toBe("2025-12");
    expect(shiftMonth("2026-12", 1)).toBe("2027-01");
    expect(shiftMonth("2026-05", 0)).toBe("2026-05");
  });

  it("lists trailing months oldest first", () => {
    expect(trailingMonths("2026-02", 3)).toEqual(["2025-12", "2026-01", "2026-02"]);
  });

  it("formats a month label", () => {
    expect(formatMonth("2026-11")).toBe("Nov 2026");
  });

  it("computes today in a given timezone", () => {
    // 2026-11-08T23:30Z is already the 9th in Tokyo but still the 8th in Vancouver
    const now = Date.UTC(2026, 10, 8, 23, 30);
    expect(todayInTz("Asia/Tokyo", now)).toBe("2026-11-09");
    expect(todayInTz("America/Vancouver", now)).toBe("2026-11-08");
  });

  it("falls back to the browser timezone for an invalid zone", () => {
    expect(isValidDateKey(todayInTz("Not/AZone"))).toBe(true);
  });
});

describe("categories", () => {
  it("ships unique default category ids in order", () => {
    const ids = DEFAULT_CATEGORIES.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(DEFAULT_CATEGORIES.map((c) => c.order)).toEqual(ids.map((_, i) => i));
  });

  it("normalises whitespace in names", () => {
    expect(normaliseCategoryName("  Eating   out ")).toBe("Eating out");
  });

  it("returns active categories sorted by order", () => {
    expect(activeCategories(CATS).map((c) => c.id)).toEqual(["a", "b"]);
  });

  it("resolves archived and unknown categories", () => {
    expect(resolveCategory("z", CATS).name).toBe("Zulu");
    expect(resolveCategory("gone", CATS)).toMatchObject({ id: "gone", name: "Uncategorised" });
  });
});

describe("validateEntry", () => {
  const valid = { amount: 1200, currency: "JPY" as const, categoryId: "a", date: "2026-11-08" };

  it("accepts a valid entry", () => {
    expect(validateEntry(valid, CATS)).toEqual([]);
  });

  it("allows archived categories so old entries stay editable", () => {
    expect(validateEntry({ ...valid, categoryId: "z" }, CATS)).toEqual([]);
  });

  it("rejects non-positive or non-finite amounts", () => {
    expect(validateEntry({ ...valid, amount: 0 }, CATS)).toEqual(["amount"]);
    expect(validateEntry({ ...valid, amount: -5 }, CATS)).toEqual(["amount"]);
    expect(validateEntry({ ...valid, amount: NaN }, CATS)).toEqual(["amount"]);
  });

  it("flags every invalid field", () => {
    expect(
      validateEntry(
        {
          amount: 1,
          currency: "XYZ" as never,
          categoryId: "nope",
          date: "2026-02-30",
          note: "x".repeat(141),
        },
        CATS,
      ),
    ).toEqual(["currency", "category", "date", "note"]);
  });
});

describe("isCurrency", () => {
  it("recognises supported currency codes", () => {
    expect(isCurrency("SGD")).toBe(true);
    expect(isCurrency("XYZ")).toBe(false);
    expect(isCurrency(undefined)).toBe(false);
  });
});
