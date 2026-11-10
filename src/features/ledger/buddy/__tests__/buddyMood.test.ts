import { describe, it, expect } from "vite-plus/test";
import type { LedgerCategory, LedgerMonth } from "@/types/ledger";
import {
  buddyMood,
  daySeed,
  isBuddyAsleep,
  moodForChange,
  moodForPace,
  noSpendStreak,
} from "../buddyMood";
import { MOOD_SCALE } from "../faces";

const TODAY = "2026-11-15"; // halfway through a 30-day month
const budgeted: LedgerCategory[] = [
  { id: "food", name: "Food", order: 0, budget: { CAD: 1000 } },
  { id: "fun", name: "Fun", order: 1 },
];
const unbudgeted: LedgerCategory[] = [{ id: "food", name: "Food", order: 0 }];

const monthDoc = (
  month: string,
  byCategory: Record<string, Record<string, number>>,
  spendDays: string[] = ["15"],
): LedgerMonth => {
  const totals: Record<string, number> = {};
  for (const amounts of Object.values(byCategory)) {
    for (const [cur, n] of Object.entries(amounts)) totals[cur] = (totals[cur] ?? 0) + n;
  }
  // Spread the month's spend over the given days.
  const byDay = Object.fromEntries(
    spendDays.map((dd) => [
      dd,
      Object.fromEntries(Object.entries(totals).map(([c, n]) => [c, n / spendDays.length])),
    ]),
  );
  return {
    month,
    entryCount: spendDays.length,
    totals,
    byCategory,
    byMember: {},
    byDay,
    computedAt: null as never,
  };
};

const moodAt = (
  spentCad: number,
  categories = budgeted,
  extra: Partial<Parameters<typeof buddyMood>[0]> = {},
) =>
  buddyMood({
    ledgerId: "l1",
    categories,
    current: monthDoc("2026-11", { food: { CAD: spentCad } }),
    today: TODAY,
    localHour: 12,
    ...extra,
  });

describe("buddyMood with a budget", () => {
  it.each([
    [150, "delighted"], // pace 0.3
    [325, "happy"], // 0.65
    [460, "content"], // 0.92
    [575, "wary"], // 1.15
    [800, "worried"], // 1.6
    [1200, "alarmed"], // over
  ] as const)("spending %d of 1000 by mid-month is %s", (spent, mood) => {
    expect(moodAt(spent).mood).toBe(mood);
  });

  it("is always alarmed once over budget", () => {
    for (const ledgerId of ["a", "b", "c", "d"]) {
      expect(moodAt(1001, budgeted, { ledgerId }).mood).toBe("alarmed");
    }
  });

  it("goes by the worst budgeted currency", () => {
    const categories: LedgerCategory[] = [
      { id: "food", name: "Food", order: 0, budget: { CAD: 1000, JPY: 10000 } },
    ];
    const state = buddyMood({
      ledgerId: "l1",
      categories,
      current: monthDoc("2026-11", { food: { CAD: 100, JPY: 15000 } }),
      today: TODAY,
      localHour: 12,
    });
    expect(state.mood).toBe("alarmed");
    expect(state.facts.currency).toBe("JPY");
  });

  it("isn't delighted in the first couple of days", () => {
    const state = buddyMood({
      ledgerId: "l1",
      categories: budgeted,
      current: monthDoc("2026-11", { food: { CAD: 5 } }, ["02"]),
      today: "2026-11-02",
      localHour: 12,
    });
    expect(state.mood).toBe("happy");
  });

  it("hands the bubble what it needs", () => {
    expect(moodAt(460).facts).toMatchObject({
      currency: "CAD",
      hasBudget: true,
      used: 0.46,
      budget: 1000,
      spent: 460,
      daysLeft: 16,
      noSpendDays: 0,
      topCategory: "Food",
    });
  });
});

describe("buddyMood without a budget", () => {
  const withPrevious = (now: number, before: number) =>
    buddyMood({
      ledgerId: "l1",
      categories: unbudgeted,
      current: monthDoc("2026-11", { food: { CAD: now } }),
      previous: monthDoc("2026-10", { food: { CAD: before } }, ["10"]),
      today: TODAY,
      localHour: 12,
    });

  it.each([
    [200, 100, "worried"], // +100%
    [120, 100, "wary"], // +20%
    [100, 100, "content"],
    [80, 100, "happy"], // −20%
    [40, 100, "delighted"], // −60%
  ] as const)("%d now vs %d last month is %s", (now, before, mood) => {
    expect(withPrevious(now, before).mood).toBe(mood);
  });

  it("is content with nothing to compare against", () => {
    expect(moodAt(300, unbudgeted).mood).toBe("content");
    expect(moodAt(300, unbudgeted).facts.hasBudget).toBe(false);
  });
});

describe("buddyMood quirks", () => {
  it("is idle when nothing's been spent this month", () => {
    expect(
      buddyMood({ ledgerId: "l1", categories: budgeted, today: TODAY, localHour: 12 }).mood,
    ).toBe("idle");
  });

  it("cheers up a step after a few days without spending", () => {
    const streaky = buddyMood({
      ledgerId: "l1",
      categories: budgeted,
      current: monthDoc("2026-11", { food: { CAD: 575 } }, ["10"]), // nothing since the 10th
      today: TODAY,
      localHour: 12,
    });
    expect(streaky.facts.noSpendDays).toBe(5);
    expect(streaky.mood).toBe("content"); // wary, one step happier
  });

  it("gives the same answer all day, for the same ledger", () => {
    expect(moodAt(575)).toEqual(moodAt(575, budgeted, { localHour: 18 }));
    expect(daySeed("l1", TODAY)).toBe(daySeed("l1", TODAY));
    expect(daySeed("l1", TODAY)).not.toBe(daySeed("l1", "2026-11-16"));
  });

  it("never wobbles more than one step from the plain thresholds", () => {
    for (let pace = 0; pace <= 2; pace += 0.01) {
      const plain = MOOD_SCALE.indexOf(moodForPace(pace));
      for (const jitter of [-0.05, 0.05]) {
        expect(Math.abs(MOOD_SCALE.indexOf(moodForPace(pace, jitter)) - plain)).toBeLessThanOrEqual(
          1,
        );
      }
      const change = pace - 1;
      const plainChange = MOOD_SCALE.indexOf(moodForChange(change));
      expect(
        Math.abs(MOOD_SCALE.indexOf(moodForChange(change, 0.05)) - plainChange),
      ).toBeLessThanOrEqual(1);
    }
  });
});

describe("sleeping", () => {
  it("sleeps from 23:00 until 07:00", () => {
    expect(isBuddyAsleep(22)).toBe(false);
    expect(isBuddyAsleep(23)).toBe(true);
    expect(isBuddyAsleep(3)).toBe(true);
    expect(isBuddyAsleep(6)).toBe(true);
    expect(isBuddyAsleep(7)).toBe(false);
  });

  it("keeps its mood underneath while asleep", () => {
    const state = moodAt(1200, budgeted, { localHour: 2 });
    expect(state.asleep).toBe(true);
    expect(state.mood).toBe("alarmed");
  });
});

describe("noSpendStreak", () => {
  it("counts back from today to the last spend", () => {
    expect(noSpendStreak({ "10": { CAD: 5 } }, 15)).toBe(5);
    expect(noSpendStreak({ "15": { CAD: 5 } }, 15)).toBe(0);
    expect(noSpendStreak({}, 4)).toBe(4);
  });
});
