import { describe, it, expect } from "vite-plus/test";
import {
  applyNoSpend,
  daysBetween,
  NO_SPEND_GAIN,
  NO_SPEND_HALF_AT,
  NO_SPEND_MIN_SHARE,
  noSpendShare,
  NO_SPEND_RECENT_ENTRY_DAYS,
  undoNoSpend,
  luckOf,
  luckTier,
  MAX_CHANCE,
  MIN_ACTIVE_DAYS,
  MIN_CHANCE,
  MOMENTUM_DECAY,
  MOMENTUM_ENTRY_GAIN,
  MOMENTUM_GAIN,
  MOMENTUM_START,
  nextLuckState,
  rollChance,
  spendingGrade,
  spendingScore,
} from "./luck";

describe("nextLuckState", () => {
  it("starts someone new at the starting momentum, plus the day's gain", () => {
    expect(nextLuckState({ today: "2026-11-18" })).toEqual({
      momentum: MOMENTUM_START + MOMENTUM_GAIN,
      lastDay: "2026-11-18",
      entryDay: "",
      noSpendDay: "",
    });
  });

  it("keeps a confirmed no-spend day through later check-ins", () => {
    const state = { momentum: 0.5, lastDay: "2026-11-18", entryDay: "", noSpendDay: "2026-11-18" };
    expect(nextLuckState({ state, today: "2026-11-19" })?.noSpendDay).toBe("2026-11-18");
  });

  it("seeds momentum from an existing check-in streak", () => {
    expect(nextLuckState({ today: "2026-11-18", streakDays: 10 })?.momentum).toBeCloseTo(
      0.5 + MOMENTUM_GAIN,
    );
    expect(nextLuckState({ today: "2026-11-18", streakDays: 40 })?.momentum).toBe(1);
  });

  it("rises a little each day in a row, and only once a day", () => {
    const state = { momentum: 0.5, lastDay: "2026-11-17", entryDay: "" };
    const next = nextLuckState({ state, today: "2026-11-18" });
    expect(next?.momentum).toBeCloseTo(0.5 + MOMENTUM_GAIN);
    expect(nextLuckState({ state: next, today: "2026-11-18" })).toBeNull();
  });

  it("adds the entry bonus once a day, even after the day's visit", () => {
    const visited = { momentum: 0.5, lastDay: "2026-11-18", entryDay: "" };
    const logged = nextLuckState({ state: visited, today: "2026-11-18", entry: true });
    expect(logged?.momentum).toBeCloseTo(0.5 + MOMENTUM_ENTRY_GAIN);
    expect(nextLuckState({ state: logged, today: "2026-11-18", entry: true })).toBeNull();
  });

  it("drains for each missed day", () => {
    const state = { momentum: 0.8, lastDay: "2026-11-13", entryDay: "" };
    // Four days missed (14th–17th).
    expect(nextLuckState({ state, today: "2026-11-18" })?.momentum).toBeCloseTo(
      0.8 - 4 * MOMENTUM_DECAY + MOMENTUM_GAIN,
    );
    expect(nextLuckState({ state, today: "2026-12-30" })?.momentum).toBe(MOMENTUM_GAIN);
  });

  it("stays within 0..1", () => {
    expect(
      nextLuckState({
        state: { momentum: 0.99, lastDay: "2026-11-17" },
        today: "2026-11-18",
        entry: true,
      })?.momentum,
    ).toBe(1);
  });

  it("ignores a day that went backwards (a timezone change)", () => {
    const state = { momentum: 0.5, lastDay: "2026-11-18", entryDay: "" };
    expect(nextLuckState({ state, today: "2026-11-17" })).toBeNull();
  });
});

describe("applyNoSpend", () => {
  const today = "2026-11-18";
  const logger = { momentum: 0.5, lastDay: today, entryDay: "2026-11-15" };

  it("adds the bonus once a day for someone who logs", () => {
    const { next, rewarded } = applyNoSpend({ state: logger, today });
    expect(rewarded).toBe(true);
    expect(next?.momentum).toBeCloseTo(0.5 + NO_SPEND_GAIN);
    expect(next?.noSpendDay).toBe(today);
    expect(applyNoSpend({ state: next, today })).toEqual({ next: null, rewarded: false, gain: 0 });
  });

  it("gives nothing without an entry in the last week", () => {
    const stale = { ...logger, entryDay: "2026-11-01" };
    expect(applyNoSpend({ state: stale, today })).toEqual({
      next: null,
      rewarded: false,
      gain: 0,
    });
    expect(applyNoSpend({ state: { ...logger, entryDay: "" }, today }).rewarded).toBe(false);
    const edge = { ...logger, entryDay: "2026-11-11" };
    expect(NO_SPEND_RECENT_ENTRY_DAYS).toBe(7);
    expect(applyNoSpend({ state: edge, today }).rewarded).toBe(true);
  });

  it("never adds to a day that already had the entry bonus", () => {
    expect(applyNoSpend({ state: { ...logger, entryDay: today }, today }).rewarded).toBe(false);
  });

  it("gives nothing before luck has started", () => {
    expect(applyNoSpend({ state: undefined, today }).rewarded).toBe(false);
  });

  it("stays within 0..1", () => {
    expect(applyNoSpend({ state: { ...logger, momentum: 0.99 }, today }).next?.momentum).toBe(1);
  });

  it("gives less when no-spend days are common lately", () => {
    const rare = applyNoSpend({ state: logger, today, recentDays: 0 });
    const common = applyNoSpend({ state: logger, today, recentDays: NO_SPEND_HALF_AT });
    expect(rare.gain).toBeCloseTo(NO_SPEND_GAIN);
    expect(common.gain).toBeCloseTo(NO_SPEND_GAIN / 2);
    expect(common.next?.momentum).toBeCloseTo(0.5 + NO_SPEND_GAIN / 2);
  });
});

describe("noSpendShare", () => {
  it("is full for a rare day and falls as they get common", () => {
    expect(noSpendShare(0)).toBe(1);
    expect(noSpendShare(NO_SPEND_HALF_AT)).toBeCloseTo(0.5);
    const shares = [0, 1, 3, 6, 10].map(noSpendShare);
    shares.slice(1).forEach((s, i) => expect(s).toBeLessThan(shares[i]));
  });

  it("never drops under the floor, nor goes over full", () => {
    expect(noSpendShare(30)).toBe(NO_SPEND_MIN_SHARE);
    expect(noSpendShare(-2)).toBe(1);
  });
});

describe("undoNoSpend", () => {
  it("takes the day's bonus back", () => {
    const state = { momentum: 0.54, lastDay: "2026-11-18", noSpendDay: "2026-11-18" };
    const next = undoNoSpend({ state, day: "2026-11-18" });
    expect(next?.momentum).toBeCloseTo(0.54 - NO_SPEND_GAIN);
    expect(next?.noSpendDay).toBe("");
  });

  it("takes back what the day gave", () => {
    const state = { momentum: 0.52, noSpendDay: "2026-11-18" };
    expect(undoNoSpend({ state, day: "2026-11-18", gain: 0.02 })?.momentum).toBeCloseTo(0.5);
  });

  it("leaves other days alone", () => {
    const state = { momentum: 0.54, noSpendDay: "2026-11-17" };
    expect(undoNoSpend({ state, day: "2026-11-18" })).toBeNull();
    expect(undoNoSpend({ state: undefined, day: "2026-11-18" })).toBeNull();
  });
});

describe("daysBetween", () => {
  it("counts whole days, across months", () => {
    expect(daysBetween("2026-11-30", "2026-12-02")).toBe(2);
    expect(daysBetween("2026-11-18", "2026-11-18")).toBe(0);
  });
});

describe("spending", () => {
  it("grades pace: full comfortably under, half on pace, nothing over", () => {
    expect(spendingGrade(0.3)).toBe(1);
    expect(spendingGrade(0.6)).toBe(1);
    expect(spendingGrade(0.8)).toBeCloseTo(0.75);
    expect(spendingGrade(1)).toBeCloseTo(0.5);
    expect(spendingGrade(1.01)).toBe(0);
    expect(spendingGrade(null)).toBeNull();
  });

  it("averages the active logs with something to grade", () => {
    expect(
      spendingScore([
        { loggedDays: 10, grade: 1 },
        { loggedDays: MIN_ACTIVE_DAYS, grade: 0 },
        // Too quiet to count, and nothing to grade.
        { loggedDays: MIN_ACTIVE_DAYS - 1, grade: 0 },
        { loggedDays: 10, grade: null },
      ]),
    ).toBe(0.5);
    expect(spendingScore([{ loggedDays: 10, grade: 0.8 }])).toBe(0.8);
  });

  it("is neutral with no log to go on", () => {
    expect(spendingScore([])).toBe(0.5);
    expect(spendingScore([{ loggedDays: 0, grade: 1 }])).toBe(0.5);
  });
});

describe("luck", () => {
  it("is half spending, half momentum", () => {
    expect(luckOf({ spending: 1, momentum: 0 })).toBe(0.5);
    expect(luckOf({ spending: 0.6, momentum: 0.8 })).toBeCloseTo(0.7);
  });

  it("reads in fifths", () => {
    expect(luckTier(0)).toBe("not_so_lucky");
    expect(luckTier(0.19)).toBe("not_so_lucky");
    expect(luckTier(0.2)).toBe("a_little_lucky");
    expect(luckTier(0.5)).toBe("average");
    expect(luckTier(0.7)).toBe("pretty_lucky");
    expect(luckTier(0.8)).toBe("super_lucky");
    expect(luckTier(1)).toBe("super_lucky");
  });

  it("turns luck into a chance per roll", () => {
    expect(rollChance({ luck: 0, findsToday: 0 })).toBe(MIN_CHANCE);
    expect(rollChance({ luck: 1, findsToday: 0 })).toBeCloseTo(MAX_CHANCE);
    expect(rollChance({ luck: 0.5, findsToday: 0 })).toBeCloseTo((MIN_CHANCE + MAX_CHANCE) / 2);
  });

  it("makes a second find in a day rare, and needs high luck for it", () => {
    expect(rollChance({ luck: 1, findsToday: 1 })).toBeCloseTo(MAX_CHANCE);
    expect(rollChance({ luck: 0.5, findsToday: 1 })).toBeCloseTo(
      ((MIN_CHANCE + MAX_CHANCE) / 2) * 0.25,
    );
    expect(rollChance({ luck: 0, findsToday: 1 })).toBe(0);
  });
});
