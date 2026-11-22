import { describe, it, expect } from "vite-plus/test";
import { Ledger, LedgerCategory, LedgerEntry, LedgerRollup } from "@/types/ledger";
import { EntryDay } from "@/utils/ledgerEntries";
import {
  activeSublogs,
  currenciesInMonth,
  hasRollups,
  hasSpending,
  memberNames,
  mergeMonth,
  sublogsInMyLogs,
  withSublogDays,
} from "../sublogs";

const categories: LedgerCategory[] = [
  { id: "food", name: "food", order: 0 },
  { id: "sublog-biz", name: "business", order: 1, sublog: { linkId: "L-biz" } },
  {
    id: "sublog-old",
    name: "old trip",
    order: 2,
    sublog: { linkId: "L-trip", unlinkedAt: {} as never },
  },
  { id: "sublog-pip", name: "pip", order: 3, sublog: { linkId: "L-pip" } },
];

const entry = (over: Partial<LedgerEntry>): LedgerEntry =>
  ({
    id: "e",
    amount: 10,
    currency: "CAD",
    categoryId: "food",
    date: "2026-11-21",
    month: "2026-11",
    authorUid: "alice",
    authorName: "Alice",
    ...over,
  }) as LedgerEntry;

const rollup = (over: Partial<LedgerRollup>): LedgerRollup =>
  ({
    month: "2026-11",
    linkId: "L-biz",
    categoryId: "sublog-biz",
    entryCount: 3,
    totals: { CAD: 42 },
    byCategory: { "sublog-biz": { CAD: 42 } },
    byMember: { alice: { CAD: 42 } },
    byDay: { "21": { CAD: 30 }, "19": { CAD: 12 } },
    countByDay: { "21": 2, "19": 1 },
    names: { alice: "Alice" },
    ...over,
  }) as LedgerRollup;

describe("linked categories", () => {
  it("maps live lines to their link, leaving ended ones out", () => {
    expect([...activeSublogs(categories)]).toEqual([
      ["sublog-biz", "L-biz"],
      ["sublog-pip", "L-pip"],
    ]);
  });

  it("finds each line's sublog among the viewer's own logs, by link id", () => {
    const mine = [
      { id: "biz", parentLink: { linkId: "L-biz" } },
      { id: "home" },
    ] as unknown as Ledger[];
    expect([...sublogsInMyLogs(categories, mine)]).toEqual([
      ["sublog-biz", "biz"],
      ["sublog-pip", null],
    ]);
  });

  it("knows a log with any sublog, past or present, may have roll-ups", () => {
    expect(hasRollups({ categories })).toBe(true);
    expect(hasRollups({ categories: [categories[0]] })).toBe(false);
    // The server's flag holds even once the lines are gone.
    expect(hasRollups({ categories: [categories[0]], hasRollups: true })).toBe(true);
  });
});

describe("mergeMonth", () => {
  it("adds roll-ups to the month's own entries", () => {
    const agg = mergeMonth([entry({})], [rollup({})]);
    expect(agg.totals).toEqual({ CAD: 52 });
    expect(agg.entryCount).toBe(1);
    expect(agg.rolledUp).toEqual({ "sublog-biz": 3 });
    expect(hasSpending(agg)).toBe(true);
  });

  it("counts a month with only sublog spending as spent", () => {
    expect(hasSpending(mergeMonth([], [rollup({})]))).toBe(true);
    expect(hasSpending(mergeMonth([], []))).toBe(false);
  });
});

describe("currenciesInMonth", () => {
  it("counts sublog currencies too", () => {
    expect(
      currenciesInMonth([{ currency: "JPY" }], [rollup({ totals: { CAD: 5 }, entryCount: 4 })]),
    ).toEqual(["CAD", "JPY"]);
  });
});

describe("memberNames", () => {
  it("names people who only spent in a sublog", () => {
    expect(memberNames([entry({ authorUid: "jo", authorName: "Jo" })], [rollup({})])).toEqual({
      alice: "Alice",
      jo: "Jo",
    });
  });
});

describe("withSublogDays", () => {
  const day = (date: string, subtotals = { CAD: 10 }): EntryDay<LedgerEntry> => ({
    date,
    label: date,
    entries: [entry({ date })],
    subtotals,
  });

  it("adds a row per sublog to its day and counts it in the subtotal", () => {
    const days = withSublogDays([day("2026-11-21")], [rollup({})], categories);
    expect(days.map((d) => d.date)).toEqual(["2026-11-21", "2026-11-19"]);
    expect(days[0].subtotals).toEqual({ CAD: 40 });
    expect(days[0].sublogs).toEqual([
      {
        categoryId: "sublog-biz",
        name: "business",
        amounts: { CAD: 30 },
        count: 2,
      },
    ]);
    // A day with only sublog spending gets its own header.
    expect(days[1].entries).toEqual([]);
    expect(days[1].subtotals).toEqual({ CAD: 12 });
  });

  it("orders a day's sublogs by category order, ended links too", () => {
    const days = withSublogDays(
      [],
      [
        rollup({
          categoryId: "sublog-pip",
          linkId: "L-pip",
          byDay: { "01": { CAD: 1 } },
          countByDay: { "01": 1 },
        }),
        rollup({
          categoryId: "sublog-old",
          linkId: "L-trip",
          byDay: { "01": { CAD: 2 } },
          countByDay: { "01": 1 },
        }),
      ],
      categories,
    );
    expect(days[0].sublogs.map((s) => s.name)).toEqual(["old trip", "pip"]);
  });

  it("doesn't change the days it was given", () => {
    const given = [day("2026-11-21")];
    withSublogDays(given, [rollup({})], categories);
    expect(given[0].subtotals).toEqual({ CAD: 10 });
  });
});
