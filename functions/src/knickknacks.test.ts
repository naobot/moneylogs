import { describe, it, expect } from "vite-plus/test";
import {
  dayIn,
  findableIn,
  hemisphereOf,
  hourIn,
  KNICK_KNACK_FINDS,
  loggedDaysBefore,
  MIN_DAY_GAP_MS,
  openSlot,
  parseQuietDayRequest,
  rollDay,
  RollDay,
  rollFind,
  seasonOf,
  visitRollsLeft,
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
      "mushroom",
      "pebble",
      "feather",
    ]);
    expect(findableIn({ month: 7, timezone: "America/Toronto" })).toEqual([
      "daisy",
      "sunflower",
      "dragonfly",
      "mushroom",
      "pebble",
      "feather",
    ]);
    expect(findableIn({ month: 7, timezone: "Australia/Sydney" })).toEqual([
      "pinecone",
      "persimmon",
      "pine_branch",
      "holly",
      "snowdrop",
      "mushroom",
      "pebble",
      "feather",
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

describe("rollDay", () => {
  const now = at("2026-11-14T12:00:00Z");
  const today = "2026-11-14";

  it("starts a fresh day the first time", () => {
    expect(rollDay({ marker: undefined, today, now })).toEqual({
      day: today,
      dayStartMs: now,
      slots: [],
      finds: 0,
    });
  });

  it("keeps today's slots and finds", () => {
    const marker = { day: today, dayStartMs: now - 3_600_000, slots: ["visit"], finds: 1 };
    expect(rollDay({ marker, today, now })).toEqual(marker);
  });

  it("starts a new day once the last one started long enough ago", () => {
    const marker = {
      day: "2026-11-13",
      dayStartMs: now - MIN_DAY_GAP_MS,
      slots: ["visit"],
      finds: 1,
    };
    expect(rollDay({ marker, today, now })).toMatchObject({ day: today, slots: [], finds: 0 });
  });

  it("won't count a new 'day' that comes from hopping timezones", () => {
    const marker = { day: "2026-11-13", dayStartMs: now - MIN_DAY_GAP_MS + 1, slots: [] };
    expect(rollDay({ marker, today, now })).toBeNull();
    expect(rollDay({ marker: { day: "2026-11-15", dayStartMs: 0 }, today, now })).toBeNull();
  });

  it("reads the old one-roll marker as today's entry roll", () => {
    const marker = { lastDay: today, lastAtMs: now - 3_600_000 };
    expect(rollDay({ marker, today, now })).toEqual({
      day: today,
      dayStartMs: now - 3_600_000,
      slots: ["entry"],
      finds: 0,
    });
    expect(
      rollDay({ marker: { lastDay: "2026-11-13", lastAtMs: now - 86_400_000 }, today, now }),
    ).toMatchObject({ day: today, slots: [] });
  });
});

describe("openSlot", () => {
  const day = (slots: string[]): RollDay => ({ day: "2026-11-14", dayStartMs: 0, slots, finds: 0 });

  it("gives a logged entry its own slot, once", () => {
    expect(openSlot(day(["visit", "evening"]), { kind: "entry", hour: 9 })).toBe("entry");
    expect(openSlot(day(["entry"]), { kind: "entry", hour: 9 })).toBeNull();
  });

  it("gives a visit the visit slot, then the evening one from 17:00", () => {
    expect(openSlot(day([]), { kind: "visit", hour: 20 })).toBe("visit");
    expect(openSlot(day(["visit"]), { kind: "visit", hour: 16 })).toBeNull();
    expect(openSlot(day(["visit"]), { kind: "visit", hour: 17 })).toBe("evening");
    expect(openSlot(day(["visit", "evening"]), { kind: "visit", hour: 22 })).toBeNull();
  });

  it("says whether a later visit could still roll", () => {
    expect(visitRollsLeft(null)).toBe(true);
    expect(visitRollsLeft(day(["visit"]))).toBe(true);
    expect(visitRollsLeft(day(["entry", "evening"]))).toBe(true);
    expect(visitRollsLeft(day(["visit", "evening"]))).toBe(false);
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

  it("picks super-common items 2.4 times as often as common ones", () => {
    // Mushroom (6) then acorn (2.5), out of 8.5.
    const pick = (r: number) =>
      rollFind({ rand: seq(0, r), chance: 1, findable: ["mushroom", "acorn"] });
    expect(pick(0.7)).toBe("mushroom");
    expect(pick(0.71)).toBe("acorn");
  });

  it("picks rare items 2.5 times less often than common ones", () => {
    // Autumn: acorn, pinecone, maple leaf (2.5 each) and the apple (1), out of 8.5.
    const autumn = ["acorn", "pinecone", "maple_leaf", "apple"] as const;
    const pick = (r: number) => rollFind({ rand: seq(0, r), chance: 1, findable: autumn });
    expect(pick(0)).toBe("acorn");
    expect(pick(0.29)).toBe("acorn");
    expect(pick(0.3)).toBe("pinecone");
    expect(pick(0.88)).toBe("maple_leaf");
    expect(pick(0.89)).toBe("apple");
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
