import { describe, expect, it } from "vite-plus/test";
import { hourIn, reminderDay, reminderPath } from "./eveningReminderPlan";

// 2026-11-24 20:30 in Toronto (UTC-5) is 01:30 UTC on the 25th.
const EVENING = Date.UTC(2026, 10, 25, 1, 30);
const TZ = "America/Toronto";

const base = {
  now: EVENING,
  timezone: TZ,
  optIn: undefined,
  lastDay: "2026-11-23",
  remindedDay: undefined,
};

describe("reminderDay", () => {
  it("reminds in the evening when they haven't checked in today", () => {
    expect(hourIn(EVENING, TZ)).toBe(20);
    expect(reminderDay(base)).toBe("2026-11-24");
  });

  it("stays quiet once they've checked in today", () => {
    expect(reminderDay({ ...base, lastDay: "2026-11-24" })).toBeNull();
  });

  it("reminds once a day", () => {
    expect(reminderDay({ ...base, remindedDay: "2026-11-24" })).toBeNull();
    expect(reminderDay({ ...base, remindedDay: "2026-11-23" })).toBe("2026-11-24");
  });

  it("only goes out from 20:00 to the end of 22:00, local time", () => {
    const hour = 60 * 60 * 1000;
    expect(reminderDay({ ...base, now: EVENING - hour })).toBeNull();
    expect(reminderDay({ ...base, now: EVENING + 2 * hour })).toBe("2026-11-24");
    expect(reminderDay({ ...base, now: EVENING + 3 * hour })).toBeNull();
  });

  it("can be turned off", () => {
    expect(reminderDay({ ...base, optIn: false })).toBeNull();
    expect(reminderDay({ ...base, optIn: true })).toBe("2026-11-24");
  });

  it("needs a real timezone", () => {
    expect(reminderDay({ ...base, timezone: undefined })).toBeNull();
    expect(reminderDay({ ...base, timezone: "Not/AZone" })).toBeNull();
  });

  it("lets a phone that's gone quiet for over a week be", () => {
    expect(reminderDay({ ...base, lastDay: "2026-11-17" })).toBe("2026-11-24");
    expect(reminderDay({ ...base, lastDay: "2026-11-16" })).toBeNull();
    expect(reminderDay({ ...base, lastDay: undefined })).toBeNull();
  });
});

describe("reminderPath", () => {
  it("opens the personal log, or home without one", () => {
    expect(reminderPath("abc_123")).toBe("/l/abc_123");
    expect(reminderPath(undefined)).toBe("/");
    expect(reminderPath("../evil")).toBe("/");
  });
});
