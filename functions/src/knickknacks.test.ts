import { describe, it, expect } from "vite-plus/test";
import {
  BASE_CHANCE,
  canRoll,
  dayIn,
  findableIn,
  findChance,
  hemisphereOf,
  KNICK_KNACK_SEASONS,
  loggedDaysBefore,
  MIN_ROLL_GAP_MS,
  ON_PACE_BONUS,
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
  it("has the same items and seasons as the client catalog", () => {
    const client = Object.fromEntries(
      Object.entries(KNICK_KNACKS).map(([id, info]) => [id, info.seasons]),
    );
    expect(KNICK_KNACK_SEASONS).toEqual(client);
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
      "pine_branch",
      "holly",
      "snowdrop",
    ]);
    expect(findableIn({ month: 7, timezone: "America/Toronto" })).toEqual([]);
    expect(findableIn({ month: 7, timezone: "Australia/Sydney" })).toEqual([
      "pinecone",
      "pine_branch",
      "holly",
      "snowdrop",
    ]);
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
  it("starts at the base and tops out with steady, on-pace logging", () => {
    expect(findChance({ loggedDays: 0, onPace: false })).toBe(BASE_CHANCE);
    expect(findChance({ loggedDays: 14, onPace: true })).toBeCloseTo(
      BASE_CHANCE + STEADY_BONUS + ON_PACE_BONUS,
    );
    expect(findChance({ loggedDays: 14, onPace: true })).toBeLessThanOrEqual(0.08);
  });

  it("rises with more logged days, then levels off", () => {
    const chances = [0, 3, 6, 10, 14].map((d) => findChance({ loggedDays: d, onPace: false }));
    for (let i = 1; i < chances.length; i++)
      expect(chances[i]).toBeGreaterThanOrEqual(chances[i - 1]);
    expect(chances[3]).toBe(chances[4]);
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
