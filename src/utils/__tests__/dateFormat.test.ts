import { describe, it, expect } from "vite-plus/test";
import dayjs from "dayjs";
import {
  formatDate,
  formatDateTime,
  formatMonth,
  formatShortDate,
  formatTime,
} from "@/utils/dateFormat";
import { DEFAULT_DISPLAY_PREFS, DisplayPrefs } from "@/utils/displayPrefs";

const at = dayjs("2026-11-04T09:05:00"); // a Wednesday morning
const pm = dayjs("2026-11-24T14:05:00");
const prefs = (changes: Partial<DisplayPrefs>): DisplayPrefs => ({
  ...DEFAULT_DISPLAY_PREFS,
  ...changes,
});

describe("dateFormat", () => {
  it("defaults match the formats the app used before preferences existed", () => {
    const d = DEFAULT_DISPLAY_PREFS;
    expect(formatTime(at, d)).toBe(at.format("HH:mm"));
    expect(formatDate(at, {}, d)).toBe(at.format("ddd D MMM YYYY"));
    expect(formatDate(at, { year: false }, d)).toBe(at.format("ddd D MMM"));
    expect(formatDate(at, { weekday: false }, d)).toBe(at.format("D MMM YYYY"));
    expect(formatShortDate(at, d)).toBe(at.format("D MMM"));
    expect(formatDateTime(at, {}, d)).toBe(at.format("ddd D MMM YYYY HH:mm"));
    expect(formatMonth(at, {}, d)).toBe(at.format("MMM YYYY"));
    expect(formatMonth(at, { short: true }, d)).toBe(at.format("MMM YY"));
  });

  it("formats the clock", () => {
    expect(formatTime(at, prefs({ clock: "24h" }))).toBe("09:05");
    expect(formatTime(pm, prefs({ clock: "24h" }))).toBe("14:05");
    expect(formatTime(at, prefs({ clock: "12h" }))).toBe("9:05am");
    expect(formatTime(pm, prefs({ clock: "12h" }))).toBe("2:05pm");
  });

  it("orders full dates", () => {
    expect(formatDate(at, {}, prefs({ dateOrder: "dmy" }))).toBe("Wed 4 Nov 2026");
    expect(formatDate(at, {}, prefs({ dateOrder: "mdy" }))).toBe("Wed Nov 4, 2026");
    expect(formatDate(at, {}, prefs({ dateOrder: "iso" }))).toBe("Wed 2026-11-04");
  });

  it("drops the weekday and year on request", () => {
    const bare = { weekday: false, year: false };
    expect(formatDate(at, bare, prefs({ dateOrder: "dmy" }))).toBe("4 Nov");
    expect(formatDate(at, bare, prefs({ dateOrder: "mdy" }))).toBe("Nov 4");
    expect(formatDate(at, bare, prefs({ dateOrder: "iso" }))).toBe("11-04");
    expect(formatDate(at, { weekday: false }, prefs({ dateOrder: "iso" }))).toBe("2026-11-04");
  });

  it("formats short dates and date-times together", () => {
    expect(formatShortDate(pm, prefs({ dateOrder: "mdy" }))).toBe("Nov 24");
    expect(formatDateTime(pm, {}, prefs({ dateOrder: "mdy", clock: "12h" }))).toBe(
      "Tue Nov 24, 2026 2:05pm",
    );
    expect(formatDateTime(pm, { weekday: false }, prefs({ dateOrder: "iso" }))).toBe(
      "2026-11-24 14:05",
    );
  });

  it("formats months, with ISO as year-month", () => {
    expect(formatMonth(at, {}, prefs({ dateOrder: "mdy" }))).toBe("Nov 2026");
    expect(formatMonth(at, { short: true }, prefs({ dateOrder: "iso" }))).toBe("2026-11");
  });
});
