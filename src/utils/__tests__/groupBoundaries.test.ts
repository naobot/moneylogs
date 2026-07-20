import { describe, it, expect } from "vite-plus/test";
import {
  personalStart,
  personalEnd,
  absoluteStart,
  absoluteEnd,
  timeUntilReadOnly,
  byMostRecentlyEnded,
  bySoonestStarting,
} from "@/utils/groupBoundaries";
import dayjs from "@/utils/configuredDayjs";
import type { Group } from "@/types/user";

// Minimal timestamp mock — groupBoundaries only needs toDate() and (for analytics) .seconds
const ts = (isoString: string) => ({
  toDate: () => new Date(isoString),
  seconds: new Date(isoString).getTime() / 1000,
});

// Timestamp-based group: functions fall through to group.start/end.toDate()
const timestampGroup = {
  start: ts("2024-01-15T00:00:00.000Z"),
  end: ts("2024-02-15T00:00:00.000Z"),
} as unknown as Group;

// Wall-clock group: functions use the wall-clock string interpreted in a timezone
const wallClockGroup = {
  start: ts("2024-01-15T00:00:00.000Z"),
  end: ts("2024-02-15T00:00:00.000Z"),
  startWallClock: "2024-01-15T08:00:00",
  endWallClock: "2024-02-15T22:00:00",
} as unknown as Group;

describe("personalStart", () => {
  it("uses the timestamp directly when no wall-clock is set", () => {
    const result = personalStart(timestampGroup, "America/Toronto");
    expect(result.toISOString()).toBe("2024-01-15T00:00:00.000Z");
  });

  it("interprets wall-clock in the user's timezone", () => {
    // Toronto is UTC-5 in January (no DST) → 08:00 local = 13:00 UTC
    const result = personalStart(wallClockGroup, "America/Toronto");
    expect(result.toISOString()).toBe("2024-01-15T13:00:00.000Z");
  });

  it("falls back to system timezone when none is provided", () => {
    // Just verify it returns a valid dayjs without throwing
    const result = personalStart(wallClockGroup);
    expect(result.isValid()).toBe(true);
  });
});

describe("personalEnd", () => {
  it("uses the timestamp directly when no wall-clock is set", () => {
    const result = personalEnd(timestampGroup, "America/Toronto");
    expect(result.toISOString()).toBe("2024-02-15T00:00:00.000Z");
  });

  it("interprets wall-clock in the user's timezone", () => {
    // Toronto is UTC-5 in February (no DST) → 22:00 local = 03:00 next day UTC
    const result = personalEnd(wallClockGroup, "America/Toronto");
    expect(result.toISOString()).toBe("2024-02-16T03:00:00.000Z");
  });
});

describe("absoluteStart", () => {
  it("uses the timestamp directly when no wall-clock is set", () => {
    const result = absoluteStart(timestampGroup);
    expect(result.toISOString()).toBe("2024-01-15T00:00:00.000Z");
  });

  it("interprets wall-clock in UTC+14 (the earliest timezone on Earth)", () => {
    // Pacific/Kiritimati is UTC+14 → 08:00 there = 18:00 previous day UTC
    const result = absoluteStart(wallClockGroup);
    expect(result.toISOString()).toBe("2024-01-14T18:00:00.000Z");
  });

  it("is earlier in UTC than any personalStart for the same wall-clock time", () => {
    // absoluteStart uses UTC+14 (earliest tz), so its UTC moment is the earliest possible
    const personal = personalStart(wallClockGroup, "America/Toronto"); // UTC-5 → 13:00Z
    const absolute = absoluteStart(wallClockGroup); // UTC+14 → 18:00 prev day = 2024-01-14T18:00Z
    expect(absolute.isBefore(personal)).toBe(true);
  });
});

describe("absoluteEnd", () => {
  it("uses the timestamp directly when no wall-clock is set", () => {
    const result = absoluteEnd(timestampGroup);
    expect(result.toISOString()).toBe("2024-02-15T00:00:00.000Z");
  });

  it("interprets wall-clock in UTC-12 (the latest timezone on Earth)", () => {
    // Etc/GMT+12 is UTC-12 (POSIX sign inversion) → 22:00 there = 10:00 next day UTC
    const result = absoluteEnd(wallClockGroup);
    expect(result.toISOString()).toBe("2024-02-16T10:00:00.000Z");
  });

  it("is later in UTC than any personalEnd for the same wall-clock time", () => {
    // absoluteEnd uses UTC-12 (latest tz), so its UTC moment is the latest possible
    const personal = personalEnd(wallClockGroup, "America/Toronto"); // UTC-5 → 03:00Z next day
    const absolute = absoluteEnd(wallClockGroup); // UTC-12 → 10:00Z next day
    expect(absolute.isAfter(personal)).toBe(true);
  });
});

describe("timeUntilReadOnly", () => {
  // wallClockGroup closes for everyone at 2024-02-16T10:00:00Z (22:00 in UTC-12)
  const at = (iso: string) => dayjs(iso);

  it("reports whole hours remaining until the absolute end", () => {
    expect(timeUntilReadOnly(wallClockGroup, at("2024-02-16T05:00:00.000Z"))).toBe("in 5 hours");
  });

  it("uses the singular form for exactly one hour", () => {
    expect(timeUntilReadOnly(wallClockGroup, at("2024-02-16T09:00:00.000Z"))).toBe("in 1 hour");
  });

  it("rounds down rather than up", () => {
    // 1h59m remaining should read as 1 hour, not 2
    expect(timeUntilReadOnly(wallClockGroup, at("2024-02-16T08:01:00.000Z"))).toBe("in 1 hour");
  });

  it("says 'soon' under an hour rather than 'in 0 hours'", () => {
    expect(timeUntilReadOnly(wallClockGroup, at("2024-02-16T09:30:00.000Z"))).toBe("soon");
  });

  it("says 'soon' once the absolute end has passed", () => {
    expect(timeUntilReadOnly(wallClockGroup, at("2024-02-16T11:00:00.000Z"))).toBe("soon");
  });

  it("spans the full 26-hour timezone spread for a user who finished first", () => {
    // A UTC+14 user hits their personal end 26h before the group closes for everyone
    const personal = personalEnd(wallClockGroup, "Pacific/Kiritimati");
    expect(timeUntilReadOnly(wallClockGroup, personal)).toBe("in 26 hours");
  });
});

describe("group comparators", () => {
  const group = (id: string, startWallClock: string, endWallClock: string) =>
    ({
      id,
      start: ts("2024-01-15T00:00:00.000Z"),
      end: ts("2024-02-15T00:00:00.000Z"),
      startWallClock,
      endWallClock,
    }) as unknown as Group;

  const early = group("early", "2024-01-01T09:00:00", "2024-01-05T22:00:00");
  const middle = group("middle", "2024-03-01T09:00:00", "2024-03-05T22:00:00");
  const late = group("late", "2024-06-01T09:00:00", "2024-06-05T22:00:00");

  it("byMostRecentlyEnded puts the latest end first", () => {
    const sorted = [middle, early, late].sort(byMostRecentlyEnded).map((g) => g.id);
    expect(sorted).toEqual(["late", "middle", "early"]);
  });

  it("bySoonestStarting puts the earliest start first", () => {
    const sorted = [middle, late, early].sort(bySoonestStarting).map((g) => g.id);
    expect(sorted).toEqual(["early", "middle", "late"]);
  });

  it("orders independently of the input order", () => {
    const a = [early, middle, late].sort(byMostRecentlyEnded).map((g) => g.id);
    const b = [late, early, middle].sort(byMostRecentlyEnded).map((g) => g.id);
    expect(a).toEqual(b);
  });

  it("distinguishes groups ending within the same second", () => {
    // .unix() truncates to seconds, so sub-second differences would tie
    const a = group("a", "2024-01-01T09:00:00", "2024-01-05T22:00:00.100");
    const b = group("b", "2024-01-01T09:00:00", "2024-01-05T22:00:00.900");
    expect([a, b].sort(byMostRecentlyEnded).map((g) => g.id)).toEqual(["b", "a"]);
  });
});
