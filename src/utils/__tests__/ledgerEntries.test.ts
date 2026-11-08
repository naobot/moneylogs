import { describe, it, expect } from "vite-plus/test";
import {
  defaultEntryDate,
  formatTotals,
  groupEntriesByDay,
  orderedCurrencies,
  parseAmount,
  sortEntries,
  sumByCurrency,
} from "@/utils/ledgerEntries";
import { entryFields } from "@/hooks/useLedgerEntryQuery";
import { LedgerEntry } from "@/types/ledger";
import { vi } from "vite-plus/test";

vi.mock("@/config/firebase-config", () => ({ db: {} }));

const ts = (ms: number | null) => (ms === null ? null : { toMillis: () => ms });
const entry = (
  id: string,
  date: string,
  amount: number,
  currency = "JPY",
  createdAt: number | null = 0,
): LedgerEntry =>
  ({ id, date, month: date.slice(0, 7), amount, currency, createdAt: ts(createdAt) }) as never;

describe("sortEntries", () => {
  it("orders newest day first, then most recently added within a day", () => {
    const sorted = sortEntries([
      entry("a", "2026-11-01", 1, "JPY", 10),
      entry("b", "2026-11-03", 1, "JPY", 5),
      entry("c", "2026-11-01", 1, "JPY", 20),
    ]);
    expect(sorted.map((e) => e.id)).toEqual(["b", "c", "a"]);
  });

  it("keeps a just-added entry (pending timestamp) at the top of its day", () => {
    const sorted = sortEntries([
      entry("old", "2026-11-01", 1, "JPY", 99),
      entry("new", "2026-11-01", 1, "JPY", null),
    ]);
    expect(sorted[0].id).toBe("new");
  });
});

describe("sumByCurrency and formatting", () => {
  it("sums per currency without floating point noise", () => {
    const totals = sumByCurrency([
      entry("a", "2026-11-01", 0.1, "CAD"),
      entry("b", "2026-11-01", 0.2, "CAD"),
      entry("c", "2026-11-01", 1200, "JPY"),
    ]);
    expect(totals).toEqual({ CAD: 0.3, JPY: 1200 });
  });

  it("orders currencies like the currency pickers and formats them", () => {
    const totals = { CAD: 45.5, JPY: 12000 };
    expect(orderedCurrencies(totals)).toEqual(["JPY", "CAD"]);
    expect(formatTotals(totals)).toBe("12,000 JPY · 45.5 CAD");
    expect(formatTotals({})).toBe("");
  });
});

describe("groupEntriesByDay", () => {
  it("groups by day with per-currency subtotals", () => {
    const days = groupEntriesByDay([
      entry("a", "2026-11-01", 100),
      entry("b", "2026-11-08", 5, "CAD"),
      entry("c", "2026-11-01", 250),
      entry("d", "2026-11-08", 300),
    ]);
    expect(days.map((d) => d.date)).toEqual(["2026-11-08", "2026-11-01"]);
    expect(days[0].label).toBe("Sun 8 Nov");
    expect(days[0].subtotals).toEqual({ CAD: 5, JPY: 300 });
    expect(days[1].subtotals).toEqual({ JPY: 350 });
    expect(days[1].entries.map((e) => e.id).sort()).toEqual(["a", "c"]);
  });
});

describe("defaultEntryDate", () => {
  it("uses today in the current month", () => {
    expect(defaultEntryDate("2026-11", "2026-11-08")).toBe("2026-11-08");
  });

  it("uses the last day of a past month and the first of a future one", () => {
    expect(defaultEntryDate("2026-02", "2026-11-08")).toBe("2026-02-28");
    expect(defaultEntryDate("2026-12", "2026-11-08")).toBe("2026-12-01");
  });
});

describe("parseAmount", () => {
  it("accepts plain, comma-grouped and decimal amounts", () => {
    expect(parseAmount("1200")).toBe(1200);
    expect(parseAmount(" 1,200 ")).toBe(1200);
    expect(parseAmount("3.5")).toBe(3.5);
    expect(parseAmount(".5")).toBe(0.5);
    expect(parseAmount("4.")).toBe(4);
  });

  it("rejects anything else", () => {
    for (const bad of ["", "abc", "1.2.3", "-5", "1e3", "$5"]) {
      expect(parseAmount(bad)).toBeNaN();
    }
  });
});

describe("entryFields", () => {
  it("derives the month and trims the note", () => {
    expect(
      entryFields({
        amount: 5,
        currency: "CAD",
        categoryId: "food",
        date: "2026-11-08",
        note: "  Lunch ",
      }),
    ).toEqual({
      amount: 5,
      currency: "CAD",
      categoryId: "food",
      date: "2026-11-08",
      month: "2026-11",
      note: "Lunch",
    });
  });

  it("omits a blank note", () => {
    expect(
      entryFields({
        amount: 5,
        currency: "CAD",
        categoryId: "food",
        date: "2026-11-08",
        note: "   ",
      }),
    ).not.toHaveProperty("note");
  });
});
