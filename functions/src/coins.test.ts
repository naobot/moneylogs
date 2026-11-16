import { describe, it, expect } from "vite-plus/test";
import { COIN_ACHIEVEMENTS } from "../../src/features/ledger/buddy/knickknacks/coinAchievements";
import {
  coinAchievementId,
  CoinId,
  coinsDue,
  dayBefore,
  nextStreak,
  parseCheckInRequest,
  STARTER_COIN,
  STREAK_COINS,
} from "./coins";
import { KNICK_KNACK_FINDS, findableIn } from "./knickknacks";
import { giftBlock } from "./giftsPlan";

describe("coins", () => {
  it("are all knick-knacks, and never turn up by chance", () => {
    const coins: CoinId[] = [STARTER_COIN, ...STREAK_COINS.map((c) => c.item)];
    for (const id of coins) expect(KNICK_KNACK_FINDS[id].rarity).toBe("milestone");
    for (let month = 1; month <= 12; month++) {
      const findable: string[] = findableIn({ month, timezone: "America/Toronto" });
      expect(findable.filter((id) => (coins as string[]).includes(id))).toEqual([]);
    }
  });

  it("each come with an achievement the app knows", () => {
    const coins: CoinId[] = [STARTER_COIN, ...STREAK_COINS.map((c) => c.item)];
    expect(Object.keys(COIN_ACHIEVEMENTS).sort()).toEqual([...coins].sort());
    expect(coinAchievementId("gold_coin")).toBe("coin__gold_coin");
  });

  it("finds the day before, across months and years", () => {
    expect(dayBefore("2026-11-16")).toBe("2026-11-15");
    expect(dayBefore("2026-03-01")).toBe("2026-02-28");
    expect(dayBefore("2027-01-01")).toBe("2026-12-31");
  });

  describe("nextStreak", () => {
    it("starts at one", () => {
      expect(nextStreak(undefined, "2026-11-16")).toEqual({ lastDay: "2026-11-16", days: 1 });
    });

    it("adds a day after yesterday", () => {
      expect(nextStreak({ lastDay: "2026-11-15", days: 9 }, "2026-11-16")).toEqual({
        lastDay: "2026-11-16",
        days: 10,
      });
    });

    it("starts over after a missed day", () => {
      expect(nextStreak({ lastDay: "2026-11-14", days: 9 }, "2026-11-16")).toEqual({
        lastDay: "2026-11-16",
        days: 1,
      });
    });

    it("counts each day once, and ignores a day going backwards", () => {
      expect(nextStreak({ lastDay: "2026-11-16", days: 3 }, "2026-11-16")).toBeNull();
      expect(nextStreak({ lastDay: "2026-11-16", days: 3 }, "2026-11-15")).toBeNull();
    });
  });

  describe("coinsDue", () => {
    it("gives the copper coin for a first logged entry, not for opening a log", () => {
      expect(coinsDue({ days: 1, given: [], loggedEntry: true })).toEqual(["copper_coin"]);
      expect(coinsDue({ days: 1, given: [], loggedEntry: false })).toEqual([]);
      expect(coinsDue({ days: 2, given: ["copper_coin"], loggedEntry: true })).toEqual([]);
    });

    it("gives silver at 10 days, gold at 30, extra shiny gold at 100", () => {
      const given = ["copper_coin"];
      expect(coinsDue({ days: 9, given, loggedEntry: false })).toEqual([]);
      expect(coinsDue({ days: 10, given, loggedEntry: false })).toEqual(["silver_coin"]);
      expect(coinsDue({ days: 30, given: [...given, "silver_coin"], loggedEntry: false })).toEqual([
        "gold_coin",
      ]);
      expect(
        coinsDue({
          days: 100,
          given: [...given, "silver_coin", "gold_coin"],
          loggedEntry: false,
        }),
      ).toEqual(["extra_shiny_gold_coin"]);
    });

    it("gives each coin once", () => {
      const given = ["copper_coin", "silver_coin"];
      expect(coinsDue({ days: 11, given, loggedEntry: true })).toEqual([]);
      // A second 10-day streak later on doesn't give another silver.
      expect(coinsDue({ days: 10, given, loggedEntry: false })).toEqual([]);
    });

    it("catches up on any coin a long streak has passed", () => {
      expect(coinsDue({ days: 31, given: [], loggedEntry: false })).toEqual([
        "silver_coin",
        "gold_coin",
      ]);
    });
  });

  it("stay with whoever earned them", () => {
    expect(giftBlock({ seenAt: 1, source: "milestone" })).toBe("milestone");
    expect(giftBlock({ seenAt: 1 })).toBeNull();
  });

  it("parses a check-in request", () => {
    expect(parseCheckInRequest({ ledgerId: "abc_123" })).toEqual({ ledgerId: "abc_123" });
    expect(parseCheckInRequest({ ledgerId: "a/b" })).toBeNull();
    expect(parseCheckInRequest(null)).toBeNull();
  });
});
