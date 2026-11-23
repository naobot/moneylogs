import { describe, it, expect, beforeEach } from "vite-plus/test";
import { LedgerCategory } from "@/types/ledger";
import {
  SKIP,
  initialMapping,
  mapRows,
  previewByMonth,
  readSavedMapping,
  saveMapping,
  sourceCategories,
  splitChecked,
} from "../plan";
import { ImportRow } from "../types";

const row = (overrides: Partial<ImportRow> = {}): ImportRow => ({
  externalId: "x",
  date: "2024-11-03",
  amount: 100,
  currency: "JPY",
  sourceCategory: "食費",
  ...overrides,
});

const categories: LedgerCategory[] = [
  { id: "food", name: "Food", order: 0 },
  { id: "fun", name: "fun", order: 1 },
  { id: "old", name: "Old", order: 2, archived: true },
];

describe("sourceCategories", () => {
  it("counts rows per category, most first, ties by name", () => {
    expect(
      sourceCategories([
        row({ sourceCategory: "b" }),
        row({ sourceCategory: "a" }),
        row({ sourceCategory: "c" }),
        row({ sourceCategory: "c" }),
      ]),
    ).toEqual([
      { name: "c", count: 2 },
      { name: "a", count: 1 },
      { name: "b", count: 1 },
    ]);
  });
});

describe("initialMapping", () => {
  const sources = [
    { name: "FOOD", count: 1 },
    { name: "Fun", count: 1 },
    { name: "Old", count: 1 },
    { name: "Rent", count: 1 },
  ];

  it("matches names ignoring case and skips the rest (including archived)", () => {
    expect(initialMapping(sources, categories)).toEqual({
      FOOD: "food",
      Fun: "fun",
      Old: SKIP,
      Rent: SKIP,
    });
  });

  it("prefers a saved choice, including a saved skip, while it's still active", () => {
    expect(
      initialMapping(sources, categories, { FOOD: SKIP, Rent: "fun", Old: "old", Fun: "gone" }),
    ).toEqual({ FOOD: SKIP, Fun: "fun", Old: SKIP, Rent: "fun" });
  });
});

describe("mapRows", () => {
  it("swaps the source category for the mapped id and drops skipped rows", () => {
    expect(
      mapRows([row({ sourceCategory: "a", note: "n" }), row({ sourceCategory: "b" })], {
        a: "food",
        b: SKIP,
      }),
    ).toEqual([
      {
        externalId: "x",
        date: "2024-11-03",
        amount: 100,
        currency: "JPY",
        note: "n",
        categoryId: "food",
      },
    ]);
  });

  it("drops rows whose category isn't in the mapping", () => {
    expect(mapRows([row({ sourceCategory: "?" })], {})).toEqual([]);
  });
});

describe("previewByMonth", () => {
  it("groups by month, oldest first, totalling per currency", () => {
    const mapped = mapRows(
      [
        row({ date: "2024-12-01", amount: 5, currency: "CAD" }),
        row({ date: "2024-11-03", amount: 100 }),
        row({ date: "2024-11-20", amount: 250 }),
        row({ date: "2024-12-02", amount: 300 }),
      ],
      { 食費: "food" },
    );
    expect(previewByMonth(mapped)).toEqual([
      { month: "2024-11", count: 2, totals: { JPY: 350 } },
      { month: "2024-12", count: 2, totals: { CAD: 5, JPY: 300 } },
    ]);
  });
});

describe("saved mappings", () => {
  beforeEach(() => window.localStorage.clear());

  it("round-trip per ledger and source", () => {
    saveMapping("L1", "ynab", { a: "food", b: SKIP });
    expect(readSavedMapping("L1", "ynab")).toEqual({ a: "food", b: SKIP });
    expect(readSavedMapping("L1", "moneyforward")).toEqual({});
    expect(readSavedMapping("L2", "ynab")).toEqual({});
  });

  it("ignore junk", () => {
    window.localStorage.setItem("ML__importMapping_L1_ynab", '{"a":1,"b":"fun"}');
    expect(readSavedMapping("L1", "ynab")).toEqual({ b: "fun" });
    window.localStorage.setItem("ML__importMapping_L1_ynab", "not json");
    expect(readSavedMapping("L1", "ynab")).toEqual({});
  });
});

describe("splitChecked", () => {
  const rows = [row({ externalId: "a" }), row({ externalId: "b" }), row({ externalId: "c" })];

  it("drops rows imported before and holds back flagged ones until included", () => {
    const check = {
      alreadyImported: new Set(["a"]),
      possibleDuplicates: { c: { entryId: "e1" } },
    };
    const held = splitChecked(rows, check, new Set());
    expect(held.alreadyImported).toBe(1);
    expect(held.fresh.map((r) => r.externalId)).toEqual(["b", "c"]);
    expect(held.flagged.map((r) => r.externalId)).toEqual(["c"]);
    expect(held.toImport.map((r) => r.externalId)).toEqual(["b"]);

    expect(splitChecked(rows, check, new Set(["c"])).toImport.map((r) => r.externalId)).toEqual([
      "b",
      "c",
    ]);
  });

  it("lets everything through without a check", () => {
    const split = splitChecked(rows, undefined, new Set());
    expect(split).toMatchObject({ alreadyImported: 0, flagged: [] });
    expect(split.toImport).toHaveLength(3);
  });
});
