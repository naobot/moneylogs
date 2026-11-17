import { describe, it, expect } from "vite-plus/test";
import {
  MAX_IMPORT_ROWS,
  findPossibleDuplicates,
  parseCheckRows,
  importEntryId,
  importMonths,
  isImportCreate,
  parseImportRequest,
  parseImportRows,
} from "./ledgerImportPlan";

const row = (overrides: Record<string, unknown> = {}) => ({
  externalId: "mf:abc",
  date: "2024-11-03",
  amount: 1280,
  currency: "JPY",
  categoryId: "food",
  note: "ローソン",
  ...overrides,
});

describe("parseImportRequest", () => {
  it("accepts a known source, a plain ledger id and some rows", () => {
    expect(parseImportRequest({ ledgerId: "L1", source: "ynab", rows: [row()] })).toEqual({
      ledgerId: "L1",
      source: "ynab",
      rows: [row()],
    });
  });

  it("rejects bad shapes with a message", () => {
    expect(parseImportRequest(null)).toBeTypeOf("string");
    expect(parseImportRequest({ ledgerId: "a/b", source: "ynab", rows: [row()] })).toBeTypeOf(
      "string",
    );
    expect(parseImportRequest({ ledgerId: "L1", source: "mint", rows: [row()] })).toBeTypeOf(
      "string",
    );
    expect(parseImportRequest({ ledgerId: "L1", source: "ynab", rows: [] })).toBeTypeOf("string");
    expect(
      parseImportRequest({
        ledgerId: "L1",
        source: "ynab",
        rows: Array.from({ length: MAX_IMPORT_ROWS + 1 }, () => row()),
      }),
    ).toBeTypeOf("string");
  });
});

describe("parseImportRows", () => {
  const categories = new Set(["food", "fun"]);

  it("keeps valid rows, rounding amounts and trimming notes", () => {
    expect(parseImportRows([row({ amount: 4.505, note: "  latte " })], categories)).toEqual([
      row({ amount: 4.51, note: "latte" }),
    ]);
    expect(parseImportRows([row({ note: "  " })], categories)).toEqual([
      {
        externalId: "mf:abc",
        date: "2024-11-03",
        amount: 1280,
        currency: "JPY",
        categoryId: "food",
      },
    ]);
  });

  it.each([
    ["an unknown category", { categoryId: "rent" }],
    ["a zero amount", { amount: 0 }],
    ["a negative amount", { amount: -5 }],
    ["a non-finite amount", { amount: Infinity }],
    ["an impossible date", { date: "2024-02-30" }],
    ["a malformed date", { date: "2024/11/03" }],
    ["a lowercase currency", { currency: "jpy" }],
    ["an over-long note", { note: "x".repeat(141) }],
    ["an empty external id", { externalId: "" }],
  ])("rejects the whole batch for %s", (_label, overrides) => {
    expect(parseImportRows([row(), row(overrides)], categories)).toBe("Row 2 is invalid.");
  });
});

describe("importEntryId", () => {
  it("is deterministic, prefixed and safe as a doc id", () => {
    const id = importEntryId("moneyforward", "uid1", "mf:abc");
    expect(id).toBe(importEntryId("moneyforward", "uid1", "mf:abc"));
    expect(id).toMatch(/^imp_moneyforward_[0-9a-f]{40}$/);
  });

  it("differs per importer and per row", () => {
    const base = importEntryId("ynab", "uid1", "x");
    expect(importEntryId("ynab", "uid2", "x")).not.toBe(base);
    expect(importEntryId("ynab", "uid1", "y")).not.toBe(base);
  });
});

describe("importMonths", () => {
  it("lists each touched month once, sorted", () => {
    expect(
      importMonths([{ date: "2024-12-01" }, { date: "2024-11-30" }, { date: "2024-11-03" }]),
    ).toEqual(["2024-11", "2024-12"]);
  });
});

describe("isImportCreate", () => {
  it("is true only when an imported entry is first written", () => {
    expect(isImportCreate(undefined, { importBatchId: "b1" })).toBe(true);
    expect(isImportCreate({ importBatchId: "b1" }, { importBatchId: "b1" })).toBe(false);
    expect(isImportCreate(undefined, {})).toBe(false);
    expect(isImportCreate({ importBatchId: "b1" }, undefined)).toBe(false);
  });
});

describe("parseCheckRows", () => {
  it("needs no category or note, and rounds amounts", () => {
    expect(
      parseCheckRows([{ externalId: "a", date: "2024-11-03", amount: 4.505, currency: "CAD" }]),
    ).toEqual([{ externalId: "a", date: "2024-11-03", amount: 4.51, currency: "CAD" }]);
  });

  it("still rejects bad rows", () => {
    expect(parseCheckRows([row(), row({ amount: 0 })])).toBe("Row 2 is invalid.");
  });
});

describe("findPossibleDuplicates", () => {
  const incoming = (externalId: string, overrides: Record<string, unknown> = {}) => ({
    externalId,
    date: "2024-11-03",
    amount: 4.5,
    currency: "CAD",
    ...overrides,
  });
  const entry = (id: string, overrides: Record<string, unknown> = {}) => ({
    id,
    date: "2024-11-03",
    amount: 4.5,
    currency: "CAD",
    ...overrides,
  });

  it("matches on day, currency and amount, with the entry's note and author", () => {
    expect(
      findPossibleDuplicates(
        [incoming("a")],
        [entry("e1", { note: "coffee", authorName: "Mina" })],
        new Set(),
      ),
    ).toEqual({ a: { entryId: "e1", note: "coffee", authorName: "Mina" } });
  });

  it("ignores entries that differ in any of the three", () => {
    expect(
      findPossibleDuplicates(
        [incoming("a")],
        [
          entry("day", { date: "2024-11-04" }),
          entry("currency", { currency: "JPY" }),
          entry("amount", { amount: 4.51 }),
        ],
        new Set(),
      ),
    ).toEqual({});
  });

  it("pairs one-to-one in file order, so a second identical purchase isn't hidden", () => {
    expect(
      findPossibleDuplicates([incoming("a"), incoming("b")], [entry("e1")], new Set()),
    ).toEqual({ a: { entryId: "e1" } });
  });

  it("never matches entries this file's earlier rows were imported as", () => {
    // Two identical coffees; the first was imported before (as imp1).
    expect(findPossibleDuplicates([incoming("b")], [entry("imp1")], new Set(["imp1"]))).toEqual({});
  });

  it("tolerates float noise in stored amounts", () => {
    expect(
      findPossibleDuplicates(
        [incoming("a", { amount: 0.3 })],
        [entry("e1", { amount: 0.1 + 0.2 })],
        new Set(),
      ),
    ).toEqual({ a: { entryId: "e1" } });
  });
});
