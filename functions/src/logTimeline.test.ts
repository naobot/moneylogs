import { describe, it, expect } from "vite-plus/test";
import dayjs from "../../src/utils/configuredDayjs";
import {
  absoluteEndMs,
  DAY_MS,
  personalEndMs,
  timelineNotificationsFor,
  timelineQueryWindow,
  wallClockToInstant,
} from "./logTimeline";

const HOUR = 3_600_000;

describe("wallClockToInstant", () => {
  // The client computes personal ends with dayjs.tz, so the server must agree with it.
  it.each([
    ["2026-11-20T21:00", "UTC"],
    ["2026-11-20T21:00", "Asia/Tokyo"],
    ["2026-11-20T21:00", "America/Vancouver"],
    ["2026-11-20T21:00", "Pacific/Kiritimati"],
    ["2026-11-20T21:00", "Etc/GMT+12"],
    ["2026-07-01T09:30", "Europe/London"],
    ["2026-03-08T12:00", "America/New_York"], // the day DST starts
    ["2026-11-01T12:00", "America/New_York"], // the day DST ends
    ["2026-10-04T12:00", "Australia/Sydney"], // southern-hemisphere DST start
  ])("matches dayjs.tz for %s in %s", (wallClock, zone) => {
    expect(wallClockToInstant(wallClock, zone)).toBe(dayjs.tz(wallClock, zone).valueOf());
  });

  it("returns null for a malformed time or an unknown zone", () => {
    expect(wallClockToInstant("tomorrow", "UTC")).toBeNull();
    expect(wallClockToInstant("2026-11-20T21:00", "Mars/Olympus")).toBeNull();
  });
});

const END = "2026-11-20T21:00";
const group = {
  id: "g1",
  title: "Tokyo Trip",
  endWallClock: END,
  // As stored when created from Vancouver.
  endMs: dayjs.tz(END, "America/Vancouver").valueOf(),
};
const tokyoEnd = dayjs.tz(END, "Asia/Tokyo").valueOf();

describe("personal and absolute ends", () => {
  it("reads the wall clock in the member's zone", () => {
    expect(personalEndMs(group, "Asia/Tokyo")).toBe(tokyoEnd);
  });

  it("falls back to the stored end without a usable zone or wall clock", () => {
    expect(personalEndMs(group, undefined)).toBe(group.endMs);
    expect(personalEndMs(group, "Mars/Olympus")).toBe(group.endMs);
    expect(personalEndMs({ ...group, endWallClock: undefined }, "Asia/Tokyo")).toBe(group.endMs);
  });

  it("ends for everyone when UTC-12 reaches the wall clock", () => {
    expect(absoluteEndMs(group)).toBe(dayjs.tz(END, "Etc/GMT+12").valueOf());
  });

  it("queries a window wide enough for every zone", () => {
    const now = tokyoEnd;
    const { from, to } = timelineQueryWindow(now);
    for (const zone of ["Pacific/Kiritimati", "Etc/GMT+12"]) {
      const end = dayjs.tz(END, zone).valueOf();
      // Any member due a notification has a personal end within a day of now…
      if (Math.abs(end - now) < DAY_MS) {
        // …and the log's stored end must then fall inside the query window.
        expect(group.endMs).toBeGreaterThanOrEqual(from);
        expect(group.endMs).toBeLessThanOrEqual(to);
      }
    }
  });
});

describe("timelineNotificationsFor", () => {
  const tokyo = { timezone: "Asia/Tokyo" };

  it("says nothing more than a day before your end", () => {
    expect(timelineNotificationsFor(group, tokyo, tokyoEnd - DAY_MS - HOUR)).toEqual([]);
    // Exactly 24h is not yet "under 24 hours", as in Group.tsx.
    expect(timelineNotificationsFor(group, tokyo, tokyoEnd - DAY_MS)).toEqual([]);
  });

  it("warns once under a day remains", () => {
    expect(timelineNotificationsFor(group, tokyo, tokyoEnd - 3 * HOUR)).toEqual([
      {
        id: "log_ending_g1",
        data: {
          type: "log_ending",
          groupId: "g1",
          groupName: "Tokyo Trip",
          logKind: "social",
          endsAt: new Date(tokyoEnd),
        },
      },
    ]);
  });

  it("reports the end, with when the summary unlocks, for a day afterwards", () => {
    const [ended] = timelineNotificationsFor(group, tokyo, tokyoEnd);
    expect(ended.id).toBe("log_ended_g1");
    expect(ended.data.type).toBe("log_ended");
    expect(ended.data.summaryAt).toEqual(new Date(absoluteEndMs(group)));
    expect(timelineNotificationsFor(group, tokyo, tokyoEnd + DAY_MS - 1)).toHaveLength(1);
    expect(timelineNotificationsFor(group, tokyo, tokyoEnd + DAY_MS)).toEqual([]);
  });

  it("uses each member's own end", () => {
    const now = tokyoEnd + HOUR;
    expect(timelineNotificationsFor(group, tokyo, now)[0].data.type).toBe("log_ended");
    // Vancouver is 17 hours behind Tokyo, so it's still ending there.
    expect(
      timelineNotificationsFor(group, { timezone: "America/Vancouver" }, now)[0].data.type,
    ).toBe("log_ending");
  });

  it("respects a member who switched the type off", () => {
    const optedOut = { ...tokyo, notificationPrefs: { log_ending: false } };
    expect(timelineNotificationsFor(group, optedOut, tokyoEnd - HOUR)).toEqual([]);
    expect(timelineNotificationsFor(group, optedOut, tokyoEnd + HOUR)).toHaveLength(1);
  });
});
