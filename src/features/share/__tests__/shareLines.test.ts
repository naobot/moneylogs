import { describe, it, expect } from "vite-plus/test";
import type { LedgerCategory, LedgerEntry } from "@/types/ledger";
import {
  breakdownSlices,
  budgetLine,
  formatTimes,
  monthPaceLine,
  noSpendLine,
  pickShareKnickKnack,
  shareLines,
  shareDayOf,
  shareMonths,
  usualDayLine,
} from "../shareLines";

const ME = "me";
const e = (date: string, amount: number, extra: Partial<LedgerEntry> = {}) =>
  ({
    id: `${date}-${amount}-${Math.random()}`,
    amount,
    currency: "CAD",
    categoryId: "food",
    date,
    month: date.slice(0, 7),
    authorUid: ME,
    authorName: "Me",
    ...extra,
  }) as unknown as LedgerEntry;

// 2026-11-21 is a Saturday; the eight Saturdays before it run back to 2026-09-26.
const SAT = "2026-11-21";
const SATURDAYS = [
  "2026-11-14",
  "2026-11-07",
  "2026-10-31",
  "2026-10-24",
  "2026-10-17",
  "2026-10-10",
  "2026-10-03",
  "2026-09-26",
];

const byDate = (entries: LedgerEntry[]) => {
  const map = new Map<string, number>();
  for (const x of entries) map.set(x.date, (map.get(x.date) ?? 0) + x.amount);
  return map;
};

describe("shareMonths", () => {
  it("covers this month and the two before", () => {
    expect(shareMonths("2026-01-05")).toEqual(["2025-11", "2025-12", "2026-01"]);
  });
});

describe("formatTimes", () => {
  it("rounds down, in half steps below 3", () => {
    expect(formatTimes(1.6)).toBe("1.5×");
    expect(formatTimes(2.99)).toBe("2.5×");
    expect(formatTimes(3.9)).toBe("3×");
    expect(formatTimes(10.2)).toBe("10×");
  });
});

describe("usualDayLine", () => {
  const history = SATURDAYS.map((d) => e(d, 60));

  it("brags in times when today is well under the usual", () => {
    const map = byDate([...history, e(SAT, 20)]);
    expect(
      usualDayLine({ byDate: map, firstDate: "2026-09-01", today: SAT, confirmedToday: false }),
    ).toEqual({ kind: "usual_day", text: "I spent 3× less than on a usual Saturday!" });
  });

  it("uses a percentage for smaller drops, and says nothing for tiny ones", () => {
    const line = (spent: number) =>
      usualDayLine({
        byDate: byDate([...history, e(SAT, spent)]),
        firstDate: "2026-09-01",
        today: SAT,
        confirmedToday: false,
      });
    expect(line(45)?.text).toBe("I spent 25% less than on a usual Saturday!");
    expect(line(55)).toBeNull();
  });

  it("never brags about spending more than usual", () => {
    expect(
      usualDayLine({
        byDate: byDate([...history, e(SAT, 200)]),
        firstDate: "2026-09-01",
        today: SAT,
        confirmedToday: false,
      }),
    ).toBeNull();
  });

  it("only praises a zero day the person confirmed", () => {
    const args = { byDate: byDate(history), firstDate: "2026-09-01", today: SAT };
    expect(usualDayLine({ ...args, confirmedToday: false })).toBeNull();
    expect(usualDayLine({ ...args, confirmedToday: true })?.text).toBe(
      "Spent nothing on a Saturday, when I usually do!",
    );
  });

  it("needs enough weeks of logging, counted from the first entry", () => {
    const map = byDate([...history, e(SAT, 10)]);
    // Since 2026-10-25 only three Saturdays count.
    expect(
      usualDayLine({ byDate: map, firstDate: "2026-10-25", today: SAT, confirmedToday: false }),
    ).toBeNull();
    expect(
      usualDayLine({ byDate: map, firstDate: "2026-10-24", today: SAT, confirmedToday: false }),
    ).not.toBeNull();
    expect(usualDayLine({ byDate: map, firstDate: null, today: SAT, confirmedToday: false })).toBe(
      null,
    );
  });

  it("has nothing to compare with when usual is nothing", () => {
    expect(
      usualDayLine({
        byDate: byDate([e(SAT, 5)]),
        firstDate: "2026-09-01",
        today: SAT,
        confirmedToday: false,
      }),
    ).toBeNull();
  });
});

describe("shareDayOf", () => {
  it("keeps the evening before until the buddy wakes at 07:00", () => {
    expect(shareDayOf("2026-11-22", 0)).toEqual({ day: SAT, word: "yesterday" });
    expect(shareDayOf("2026-11-22", 6)).toEqual({ day: SAT, word: "yesterday" });
    expect(shareDayOf("2026-11-22", 7)).toEqual({ day: "2026-11-22", word: "today" });
    expect(shareDayOf(SAT, 23)).toEqual({ day: SAT, word: "today" });
  });

  it("crosses month and year ends", () => {
    expect(shareDayOf("2027-01-01", 1).day).toBe("2026-12-31");
  });
});

describe("noSpendLine", () => {
  it("names a streak, or just today", () => {
    expect(noSpendLine(new Set([SAT]), SAT)?.text).toBe("Nothing spent today ✓");
    expect(noSpendLine(new Set([SAT, "2026-11-20", "2026-11-19"]), SAT)?.text).toBe(
      "3 no-spend days in a row!",
    );
  });

  it("says nothing unless today is confirmed", () => {
    expect(noSpendLine(new Set(["2026-11-20"]), SAT)).toBeNull();
  });

  it("names the day as the card does", () => {
    expect(noSpendLine(new Set([SAT]), SAT, "yesterday")?.text).toBe("Nothing spent yesterday ✓");
  });
});

describe("monthPaceLine", () => {
  const args = { firstDate: "2026-10-01", today: SAT, currency: "CAD" as const };

  it("compares this month so far with the same point last month", () => {
    const entries = [e("2026-10-05", 100), e("2026-10-25", 500), e("2026-11-05", 70)];
    expect(monthPaceLine({ ...args, entries })?.text).toBe("30% less than this point last month");
  });

  it("needs a real drop", () => {
    const entries = [e("2026-10-05", 100), e("2026-11-05", 95)];
    expect(monthPaceLine({ ...args, entries })).toBeNull();
  });

  it("needs logging from the start of last month", () => {
    const entries = [e("2026-10-10", 100), e("2026-11-05", 10)];
    expect(monthPaceLine({ ...args, firstDate: "2026-10-10", entries })).toBeNull();
  });
});

describe("budgetLine", () => {
  const categories = [
    { id: "food", name: "Food", order: 0, budget: { CAD: 3000 } },
  ] as LedgerCategory[];
  const entries = [e("2026-11-02", 100)];

  it("says on track when the projection fits the budget", () => {
    expect(
      budgetLine({ entries, today: SAT, currency: "CAD", categories, isSoleMember: true })?.text,
    ).toBe("On track to stay under budget this month");
  });

  it("stays quiet in a shared log, where the budget isn't mine alone", () => {
    expect(
      budgetLine({ entries, today: SAT, currency: "CAD", categories, isSoleMember: false }),
    ).toBeNull();
  });

  it("stays quiet without a budget or when heading over", () => {
    expect(
      budgetLine({ entries, today: SAT, currency: "CAD", categories: [], isSoleMember: true }),
    ).toBeNull();
    expect(
      budgetLine({
        entries: [e("2026-11-02", 2900)],
        today: SAT,
        currency: "CAD",
        categories,
        isSoleMember: true,
      }),
    ).toBeNull();
  });
});

describe("shareLines", () => {
  const base = {
    myUid: ME,
    today: SAT,
    currency: "CAD" as const,
    categories: [] as LedgerCategory[],
    noSpendDays: new Set<string>(),
    isSoleMember: false,
  };

  it("only reads my own entries", () => {
    const others = SATURDAYS.map((d) => e(d, 60, { authorUid: "them" }));
    expect(shareLines({ ...base, entries: [...others, e(SAT, 5, { authorUid: "them" })] })).toEqual(
      [],
    );
  });

  it("ranks lines and caps them", () => {
    const entries = [...SATURDAYS.map((d) => e(d, 60)), e("2026-10-02", 900)];
    const lines = shareLines({
      ...base,
      entries,
      noSpendDays: new Set([SAT, "2026-11-20"]),
      categories: [
        { id: "food", name: "Food", order: 0, budget: { CAD: 5000 } },
      ] as LedgerCategory[],
      isSoleMember: true,
    });
    expect(lines.map((l) => l.kind)).toEqual(["usual_day", "no_spend", "month_pace"]);
  });

  it("falls back to a modest line when I logged today", () => {
    expect(shareLines({ ...base, entries: [e(SAT, 20)] })).toEqual([
      { kind: "kept_up", text: "Kept my log up today" },
    ]);
    expect(shareLines({ ...base, entries: [e("2026-11-20", 20)] })).toEqual([]);
  });

  it("covers yesterday after midnight, by name and without the new day's entries", () => {
    const entries = [e(SAT, 20), e("2026-11-22", 500)];
    expect(shareLines({ ...base, entries, dayWord: "yesterday" })).toEqual([
      { kind: "kept_up", text: "Kept my log up yesterday" },
    ]);
  });

  it("never puts an amount on the card", () => {
    const entries = [...SATURDAYS.map((d) => e(d, 61.37)), e(SAT, 12.5), e("2026-10-02", 873.21)];
    const text = shareLines({ ...base, entries, noSpendDays: new Set() })
      .map((l) => l.text)
      .join(" ");
    for (const amount of ["61.37", "12.5", "873.21", "$", "CAD"])
      expect(text).not.toContain(amount);
  });
});

describe("breakdownSlices", () => {
  const categories = ["a", "b", "c", "d", "e", "f", "g"].map((id, order) => ({
    id,
    name: id.toUpperCase(),
    order,
  })) as LedgerCategory[];
  const args = { myUid: ME, period: { month: "2026-11" }, currency: "CAD" as const, categories };

  it("gives shares only, biggest first, folding the tail into other", () => {
    const entries = [70, 60, 50, 40, 30, 20, 10].map((amount, i) =>
      e("2026-11-03", amount, { categoryId: categories[i].id }),
    );
    const slices = breakdownSlices({ ...args, entries });
    expect(slices.map((s) => s.name)).toEqual(["A", "B", "C", "D", "E", "other"]);
    expect(slices.reduce((sum, s) => sum + s.share, 0)).toBeCloseTo(1);
    expect(slices[0]).toEqual({ id: "a", name: "A", share: 70 / 280 });
  });

  it("keeps a sixth category rather than calling one category other", () => {
    const entries = [6, 5, 4, 3, 2, 1].map((amount, i) =>
      e("2026-11-03", amount, { categoryId: categories[i].id }),
    );
    expect(breakdownSlices({ ...args, entries }).map((s) => s.name)).toEqual([
      "A",
      "B",
      "C",
      "D",
      "E",
      "F",
    ]);
  });

  it("only counts my entries in that month", () => {
    const entries = [
      e("2026-11-03", 10, { categoryId: "a" }),
      e("2026-11-03", 90, { authorUid: "them", categoryId: "b" }),
      e("2026-10-03", 90, { categoryId: "c" }),
    ];
    expect(breakdownSlices({ ...args, entries })).toEqual([{ id: "a", name: "A", share: 1 }]);
  });
});

describe("breakdownSlices for a day", () => {
  const categories = [
    { id: "housing", name: "Housing", order: 0 },
    { id: "gym", name: "Gym", order: 1, fixed: true },
    { id: "food", name: "Food", order: 2 },
    { id: "fun", name: "Fun", order: 3 },
  ] as LedgerCategory[];

  it("leaves out fixed costs, by default or by choice, and other days", () => {
    const entries = [
      e(SAT, 1200, { categoryId: "housing" }),
      e(SAT, 50, { categoryId: "gym" }),
      e(SAT, 30, { categoryId: "food" }),
      e(SAT, 10, { categoryId: "fun" }),
      e("2026-11-20", 99, { categoryId: "food" }),
    ];
    const slices = breakdownSlices({
      entries,
      myUid: ME,
      period: { day: SAT },
      currency: "CAD",
      categories,
    });
    expect(slices).toEqual([
      { id: "food", name: "Food", share: 0.75 },
      { id: "fun", name: "Fun", share: 0.25 },
    ]);
  });

  it("keeps fixed costs in a month", () => {
    const entries = [e(SAT, 75, { categoryId: "housing" }), e(SAT, 25, { categoryId: "food" })];
    expect(
      breakdownSlices({
        entries,
        myUid: ME,
        period: { month: "2026-11" },
        currency: "CAD",
        categories,
      }).map((s) => s.id),
    ).toEqual(["housing", "food"]);
  });
});

describe("pickShareKnickKnack", () => {
  const seen = { toMillis: () => 1 } as never;

  it("picks among kept items, each equally likely however many copies", () => {
    const finds = [
      { item: "pebble", seenAt: seen },
      { item: "pebble", seenAt: seen },
      { item: "pebble", seenAt: seen },
      { item: "acorn", seenAt: seen },
    ] as never[];
    const picks = new Set([0, 0.49, 0.5, 0.99].map((r) => pickShareKnickKnack(finds, () => r)));
    expect(picks).toEqual(new Set(["pebble", "acorn"]));
  });

  it("skips unopened finds, and is null with none kept", () => {
    expect(pickShareKnickKnack([{ item: "acorn", seenAt: null }] as never[], () => 0)).toBeNull();
    expect(pickShareKnickKnack([], () => 0)).toBeNull();
  });
});
