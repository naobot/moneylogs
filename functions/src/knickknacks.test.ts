import { describe, it, expect } from "vite-plus/test";
import {
  BASE_CHANCE,
  canRoll,
  dayIn,
  findableIn,
  findChance,
  hemisphereOf,
  hourIn,
  KNICK_KNACK_FINDS,
  loggedDaysBefore,
  MIN_ROLL_GAP_MS,
  PACE_BONUS,
  paceBonus,
  parseQuietDayRequest,
  rollFind,
  seasonOf,
  STEADY_BONUS,
} from "./knickknacks";
import { KNICK_KNACKS } from "../../src/features/ledger/buddy/knickknacks/catalog";
import {
  hemisphereOf as clientHemisphereOf,
  seasonOf as clientSeasonOf,
} from "../../src/features/ledger/buddy/knickknacks/seasons";

const at = (iso: string) => new Date(iso).getTime();

describe("knick-knacks (functions)", () => {
  it("has the same items, seasons and rarities as the client catalog", () => {
    const client = Object.fromEntries(
      Object.entries(KNICK_KNACKS).map(([id, { seasons, rarity }]) => [id, { seasons, rarity }]),
    );
    expect(KNICK_KNACK_FINDS).toEqual(client);
  });

  it("has a rare item in every season", () => {
    for (const month of [1, 4, 7, 10]) {
      const ids = findableIn({ month, timezone: "America/Toronto" });
      expect(ids.some((id) => KNICK_KNACK_FINDS[id].rarity === "rare")).toBe(true);
    }
  });

  it("agrees with the client on hemispheres and seasons", () => {
    const zones = ["Australia/Perth", "Pacific/Auckland", "America/Lima", "Europe/Oslo", ""];
    for (const tz of zones) expect(hemisphereOf(tz)).toBe(clientHemisphereOf(tz));
    for (let m = 1; m <= 12; m++) {
      expect(seasonOf(m, "north")).toBe(clientSeasonOf(m, "north"));
      expect(seasonOf(m, "south")).toBe(clientSeasonOf(m, "south"));
    }
  });

  it("finds by season in the finder's hemisphere", () => {
    expect(findableIn({ month: 1, timezone: "America/Toronto" })).toEqual([
      "pinecone",
      "persimmon",
      "pine_branch",
      "holly",
      "snowdrop",
    ]);
    expect(findableIn({ month: 7, timezone: "America/Toronto" })).toEqual([
      "daisy",
      "sunflower",
      "dragonfly",
    ]);
    expect(findableIn({ month: 7, timezone: "Australia/Sydney" })).toEqual([
      "pinecone",
      "persimmon",
      "pine_branch",
      "holly",
      "snowdrop",
    ]);
  });

  it("reads the hour in the user's timezone", () => {
    const now = at("2026-11-14T22:30:00Z");
    expect(hourIn(now, "America/Toronto")).toBe(17);
    expect(hourIn(now, "Asia/Tokyo")).toBe(7);
    expect(hourIn(now, undefined)).toBe(22);
    expect(hourIn(now, "Not/AZone")).toBe(22);
  });

  it("only takes a sensible ledger id for the quiet-day roll", () => {
    expect(parseQuietDayRequest({ ledgerId: "abc_123-X" })).toEqual({ ledgerId: "abc_123-X" });
    expect(parseQuietDayRequest({ ledgerId: "../users" })).toBeNull();
    expect(parseQuietDayRequest({})).toBeNull();
    expect(parseQuietDayRequest(null)).toBeNull();
  });

  it("reads the day in the user's timezone", () => {
    const now = at("2026-11-14T03:00:00Z");
    expect(dayIn(now, "America/Toronto")).toBe("2026-11-13");
    expect(dayIn(now, "Asia/Tokyo")).toBe("2026-11-14");
    expect(dayIn(now, undefined)).toBe("2026-11-14");
    expect(dayIn(now, "Not/AZone")).toBe("2026-11-14");
  });
});

describe("findChance", () => {
  it("gives everyone the base chance, even over budget with no recent logging", () => {
    expect(findChance({ loggedDays: 0, paceRatio: 1.5 })).toBe(BASE_CHANCE);
    expect(findChance({ loggedDays: 0, paceRatio: null })).toBe(BASE_CHANCE);
  });

  it("tops out with steady logging comfortably under pace", () => {
    expect(findChance({ loggedDays: 14, paceRatio: 0.3 })).toBeCloseTo(
      BASE_CHANCE + STEADY_BONUS + PACE_BONUS,
    );
    expect(findChance({ loggedDays: 14, paceRatio: 0.3 })).toBeCloseTo(0.08);
  });

  it("leans mostly on spending: a steady logger well under pace finds ~2.5x as often", () => {
    const over = findChance({ loggedDays: 14, paceRatio: 1.2 });
    const under = findChance({ loggedDays: 14, paceRatio: 0.5 });
    expect(under / over).toBeGreaterThan(2.5);
  });

  it("rises with more logged days, then levels off", () => {
    const chances = [0, 3, 6, 10, 14].map((d) => findChance({ loggedDays: d, paceRatio: null }));
    for (let i = 1; i < chances.length; i++)
      expect(chances[i]).toBeGreaterThanOrEqual(chances[i - 1]);
    expect(chances[3]).toBe(chances[4]);
  });
});

describe("paceBonus", () => {
  it("is full comfortably under pace, half right on it, nothing over it", () => {
    expect(paceBonus(0)).toBe(PACE_BONUS);
    expect(paceBonus(0.6)).toBe(PACE_BONUS);
    expect(paceBonus(0.8)).toBeCloseTo(PACE_BONUS * 0.75);
    expect(paceBonus(1)).toBeCloseTo(PACE_BONUS / 2);
    expect(paceBonus(1.01)).toBe(0);
  });

  it("is nothing without budgets", () => {
    expect(paceBonus(null)).toBe(0);
  });
});

describe("canRoll", () => {
  const now = at("2026-11-14T12:00:00Z");

  it("rolls the first time", () => {
    expect(canRoll({ marker: undefined, today: "2026-11-14", now })).toBe(true);
  });

  it("rolls once a day", () => {
    const marker = { lastDay: "2026-11-14", lastAtMs: now - 3_600_000 };
    expect(canRoll({ marker, today: "2026-11-14", now })).toBe(false);
    expect(
      canRoll({
        marker: { ...marker, lastDay: "2026-11-13", lastAtMs: now - 86_400_000 },
        today: "2026-11-14",
        now,
      }),
    ).toBe(true);
  });

  it("won't count a new 'day' that comes from hopping timezones", () => {
    const marker = { lastDay: "2026-11-13", lastAtMs: now - MIN_ROLL_GAP_MS + 1 };
    expect(canRoll({ marker, today: "2026-11-14", now })).toBe(false);
  });
});

describe("rollFind", () => {
  const seq =
    (...values: number[]) =>
    () =>
      values.shift() ?? 0;

  it("finds something on a hit, from what's in season", () => {
    expect(rollFind({ rand: seq(0.01, 0.6), chance: 0.05, findable: ["acorn", "pinecone"] })).toBe(
      "pinecone",
    );
  });

  it("picks rare items a third as often as common ones", () => {
    // Autumn: acorn, pinecone, maple leaf (3 each) and the apple (1), out of 10.
    const autumn = ["acorn", "pinecone", "maple_leaf", "apple"] as const;
    const pick = (r: number) => rollFind({ rand: seq(0, r), chance: 1, findable: autumn });
    expect(pick(0)).toBe("acorn");
    expect(pick(0.29)).toBe("acorn");
    expect(pick(0.31)).toBe("pinecone");
    expect(pick(0.89)).toBe("maple_leaf");
    expect(pick(0.91)).toBe("apple");
    expect(pick(0.999)).toBe("apple");
  });

  it("finds nothing on a miss", () => {
    expect(rollFind({ rand: seq(0.05), chance: 0.05, findable: ["acorn"] })).toBeNull();
  });

  it("finds nothing when nothing is in season", () => {
    expect(rollFind({ rand: seq(0), chance: 1, findable: [] })).toBeNull();
  });
});

describe("loggedDaysBefore", () => {
  it("counts days with spending in the 14 before today, across months", () => {
    const byMonth = {
      "2026-10": { byDay: { "31": { CAD: 5 }, "30": { CAD: 0 }, "20": { CAD: 9 } } },
      "2026-11": { byDay: { "01": { JPY: 300 }, "05": { CAD: 1 }, "06": { CAD: 1 } } },
    };
    // Window for the 6th: Oct 23 – Nov 5. Today (the 6th) and Oct 20 don't count.
    expect(loggedDaysBefore("2026-11-06", byMonth)).toBe(3);
  });
});
