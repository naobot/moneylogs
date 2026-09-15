import { describe, it, expect } from "vite-plus/test";
import { getAutoPostTimezone } from "@/utils/timezone";

const JAN = new Date("2026-01-15T12:00:00Z").getTime();
const JUL = new Date("2026-07-15T12:00:00Z").getTime();

describe("getAutoPostTimezone", () => {
  it("returns null when zones are identical", () => {
    expect(getAutoPostTimezone("Asia/Tokyo", JAN, "Asia/Tokyo")).toBeNull();
  });

  it("returns null for differently named zones with the same offset", () => {
    expect(getAutoPostTimezone("America/Toronto", JAN, "America/New_York")).toBeNull();
  });

  it("returns the browser zone when offsets differ", () => {
    expect(getAutoPostTimezone("Asia/Tokyo", JAN, "Europe/London")).toBe("Europe/London");
  });

  it("compares offsets at the given moment (DST)", () => {
    // Europe/London is UTC+0 in winter (same as Africa/Abidjan) but UTC+1 in summer
    expect(getAutoPostTimezone("Africa/Abidjan", JAN, "Europe/London")).toBeNull();
    expect(getAutoPostTimezone("Africa/Abidjan", JUL, "Europe/London")).toBe("Europe/London");
  });

  it("returns null when the profile or browser zone is missing", () => {
    expect(getAutoPostTimezone(undefined, JAN, "Asia/Tokyo")).toBeNull();
    expect(getAutoPostTimezone(null, JAN, "Asia/Tokyo")).toBeNull();
    expect(getAutoPostTimezone("Asia/Tokyo", JAN, "")).toBeNull();
  });

  it("returns null for invalid zone strings", () => {
    expect(getAutoPostTimezone("Not/AZone", JAN, "Asia/Tokyo")).toBeNull();
  });
});
