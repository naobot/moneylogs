import { describe, it, expect } from "vite-plus/test";
import { personalStart, personalEnd, absoluteStart, absoluteEnd } from "@/utils/groupBoundaries";
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
