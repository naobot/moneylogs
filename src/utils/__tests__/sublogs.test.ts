import { describe, it, expect } from "vite-plus/test";
import { Ledger, LedgerCategory, LedgerEntry, LedgerRollup } from "@/types/ledger";
import { EntryDay } from "@/utils/ledgerEntries";
import {
  activeSublogs,
  currenciesInMonth,
  entryCategories,
  hasRollups,
  hasSpending,
  memberNames,
  mergeMonth,
  parentChoices,
  sublogBlocker,
  withSublogDays,
} from "../sublogs";

const categories: LedgerCategory[] = [
  { id: "food", name: "food", order: 0 },
  { id: "sublog-biz", name: "business", order: 1, sublog: { ledgerId: "biz" } },
  {
    id: "sublog-old",
    name: "old trip",
    order: 2,
    sublog: { ledgerId: "trip", unlinkedAt: {} as never },
  },
  { id: "sublog-pip", name: "pip", order: 3, sublog: { ledgerId: "pip" } },
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
    childId: "biz",
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
  it("maps live links to their sublog, leaving ended ones out", () => {
    expect([...activeSublogs(categories)]).toEqual([
      ["sublog-biz", "biz"],
      ["sublog-pip", "pip"],
    ]);
  });

  it("keeps live links out of the entry form, but not ended ones", () => {
    expect(entryCategories(categories).map((c) => c.id)).toEqual(["food", "sublog-old"]);
  });

  it("knows a log with any sublog, past or present, may have roll-ups", () => {
    expect(hasRollups(categories)).toBe(true);
    expect(hasRollups([categories[0]])).toBe(false);
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
        childId: "biz",
        name: "business",
        amounts: { CAD: 30 },
        count: 2,
      },
    ]);
    // A day with only sublog spending gets its own header.
    expect(days[1].entries).toEqual([]);
    expect(days[1].subtotals).toEqual({ CAD: 12 });
  });

  it("orders a day's sublogs by category order and drops the link once unlinked", () => {
    const days = withSublogDays(
      [],
      [
        rollup({
          categoryId: "sublog-pip",
          childId: "pip",
          byDay: { "01": { CAD: 1 } },
          countByDay: { "01": 1 },
        }),
        rollup({
          categoryId: "sublog-old",
          childId: "trip",
          byDay: { "01": { CAD: 2 } },
          countByDay: { "01": 1 },
        }),
      ],
      categories,
    );
    expect(days[0].sublogs.map((s) => [s.name, s.childId])).toEqual([
      ["old trip", undefined],
      ["pip", "pip"],
    ]);
  });

  it("doesn't change the days it was given", () => {
    const given = [day("2026-11-21")];
    withSublogDays(given, [rollup({})], categories);
    expect(given[0].subtotals).toEqual({ CAD: 10 });
  });
});

describe("parentChoices", () => {
  const ledger = (id: string, over: Partial<Ledger> = {}): Ledger =>
    ({ id, title: id, memberUids: ["alice"], categories: [], ...over }) as unknown as Ledger;
  const link = { ledgerId: "x", categoryId: "c", since: "2026-11", linkedBy: "alice" };

  it("lists the other logs, personal first, marking ones that can't be parents", () => {
    const choices = parentChoices(
      [
        ledger("home"),
        ledger("trip", { parentLink: link }),
        ledger("personal-alice"),
        ledger("biz"),
      ],
      "alice",
      ledger("biz"),
    );
    expect(choices.map((c) => [c.ledger.id, c.disabledReason])).toEqual([
      ["personal-alice", undefined],
      ["home", undefined],
      ["trip", "already a sublog"],
    ]);
  });

  it("works for a log that doesn't exist yet", () => {
    expect(parentChoices([ledger("personal-alice")], "alice").map((c) => c.ledger.id)).toEqual([
      "personal-alice",
    ]);
  });

  it("offers no parents when the log itself can't be a sublog", () => {
    expect(parentChoices([ledger("home")], "alice", ledger("personal-alice"))).toEqual([]);
    expect(sublogBlocker(ledger("personal-alice"))).toBe("personal-child");
    expect(sublogBlocker(ledger("biz", { parentLink: link }))).toBe("child-already-linked");
    expect(
      sublogBlocker(
        ledger("biz", {
          categories: [{ id: "c", name: "c", order: 0, sublog: { ledgerId: "p" } }],
        }),
      ),
    ).toBe("child-is-parent");
    expect(sublogBlocker(ledger("biz"))).toBeNull();
  });
});
