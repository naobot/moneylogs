import { describe, it, expect } from "vite-plus/test";
import {
  dueForAwards,
  EXTRA_SHINY_DAYS,
  inWindow,
  nextTesterMarker,
  parseCheckInPlatform,
  parseTesterWindow,
  testerGear,
} from "./earlyTesters";

const ts = (millis: number) => ({ toMillis: () => millis });

describe("early tester window", () => {
  it("is read from config/app, with Timestamps", () => {
    expect(parseTesterWindow({ testerWindow: { from: ts(10), to: ts(20) } })).toEqual({
      from: 10,
      to: 20,
      awardedAt: null,
    });
    expect(
      parseTesterWindow({ testerWindow: { from: ts(10), to: ts(20), awardedAt: ts(25) } }),
    ).toEqual({ from: 10, to: 20, awardedAt: 25 });
  });

  it("is off while unset or half set up", () => {
    expect(parseTesterWindow(undefined)).toBeNull();
    expect(parseTesterWindow({})).toBeNull();
    expect(parseTesterWindow({ testerWindow: { from: ts(10) } })).toBeNull();
    expect(parseTesterWindow({ testerWindow: { from: ts(20), to: ts(10) } })).toBeNull();
    expect(parseTesterWindow({ testerWindow: { from: "2026-11-01", to: ts(10) } })).toBeNull();
  });

  it("counts check-ins from its start up to its end", () => {
    const window = { from: 10, to: 20, awardedAt: null };
    expect(inWindow(window, 9)).toBe(false);
    expect(inWindow(window, 10)).toBe(true);
    expect(inWindow(window, 19)).toBe(true);
    expect(inWindow(window, 20)).toBe(false);
    expect(inWindow(null, 15)).toBe(false);
  });

  it("gives its gears once, after it closes", () => {
    expect(dueForAwards({ from: 10, to: 20, awardedAt: null }, 19)).toBe(false);
    expect(dueForAwards({ from: 10, to: 20, awardedAt: null }, 20)).toBe(true);
    expect(dueForAwards({ from: 10, to: 20, awardedAt: 21 }, 30)).toBe(false);
    expect(dueForAwards(null, 30)).toBe(false);
  });
});

describe("tester marker", () => {
  it("starts on the first Android day", () => {
    expect(nextTesterMarker(undefined, "2026-12-01")).toEqual({
      firstDay: "2026-12-01",
      lastDay: "2026-12-01",
      days: 1,
      bestRun: 1,
    });
  });

  it("counts days in a row, and changes nothing on the same or an earlier day", () => {
    const marker = { firstDay: "2026-12-01", lastDay: "2026-12-02", days: 2, bestRun: 2 };
    expect(nextTesterMarker(marker, "2026-12-03")).toMatchObject({ days: 3, bestRun: 3 });
    expect(nextTesterMarker(marker, "2026-12-02")).toBeNull();
    expect(nextTesterMarker(marker, "2026-12-01")).toBeNull();
  });

  it("starts the run again after a gap, keeping the best run", () => {
    const marker = { firstDay: "2026-12-01", lastDay: "2026-12-14", days: 14, bestRun: 14 };
    expect(nextTesterMarker(marker, "2026-12-16")).toEqual({
      firstDay: "2026-12-01",
      lastDay: "2026-12-16",
      days: 1,
      bestRun: 14,
    });
  });
});

describe("tester gear", () => {
  it("is the extra shiny gear for 14 days in a row, the shiny gear otherwise", () => {
    expect(EXTRA_SHINY_DAYS).toBe(14);
    expect(testerGear({ bestRun: 13 })).toBe("shiny_gear");
    expect(testerGear({ bestRun: 14 })).toBe("extra_shiny_gear");
    expect(testerGear(undefined)).toBe("shiny_gear");
  });
});

describe("check-in platform", () => {
  it("is what the app sends, or null for older clients", () => {
    expect(parseCheckInPlatform({ platform: "android" })).toBe("android");
    expect(parseCheckInPlatform({ platform: "web" })).toBe("web");
    expect(parseCheckInPlatform({ platform: "windows" })).toBeNull();
    expect(parseCheckInPlatform(undefined)).toBeNull();
    expect(parseCheckInPlatform(null)).toBeNull();
  });
});
