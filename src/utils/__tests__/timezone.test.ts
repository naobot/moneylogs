import { describe, it, expect } from "vite-plus/test";
import {
  cityFromZone,
  getAutoPostTimezone,
  inZone,
  isValidTimeZone,
  postZoneLabel,
  tzAbbrev,
  utcOffsetLabel,
} from "@/utils/timezone";

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

describe("utcOffsetLabel", () => {
  it("formats whole, half-hour and negative offsets", () => {
    expect(utcOffsetLabel("Asia/Tokyo", JAN)).toBe("GMT+9");
    expect(utcOffsetLabel("Asia/Kolkata", JAN)).toBe("GMT+5:30");
    expect(utcOffsetLabel("America/St_Johns", JAN)).toBe("GMT-3:30");
    expect(utcOffsetLabel("UTC", JAN)).toBe("GMT");
  });

  it("follows DST", () => {
    expect(utcOffsetLabel("Europe/London", JAN)).toBe("GMT");
    expect(utcOffsetLabel("Europe/London", JUL)).toBe("GMT+1");
  });
});

describe("tzAbbrev", () => {
  it("uses a named abbreviation when there is one, else the offset", () => {
    expect(tzAbbrev("America/Los_Angeles", JAN)).toBe("PST");
    expect(tzAbbrev("America/Los_Angeles", JUL)).toBe("PDT");
    expect(tzAbbrev("Asia/Tokyo", JAN)).toBe("GMT+9");
  });

  it("returns the id for an unknown zone", () => {
    expect(tzAbbrev("Not/AZone", JAN)).toBe("Not/AZone");
  });
});

describe("cityFromZone / postZoneLabel", () => {
  it("takes the last segment of a zone id", () => {
    expect(cityFromZone("America/Argentina/Buenos_Aires")).toBe("Buenos Aires");
    expect(cityFromZone("UTC")).toBe("UTC");
  });

  it("prefers the picked place over the zone's city", () => {
    expect(postZoneLabel("Asia/Tokyo", "Kyoto", JAN)).toBe("Kyoto · GMT+9");
    expect(postZoneLabel("Asia/Tokyo", null, JAN)).toBe("Tokyo · GMT+9");
  });
});

describe("isValidTimeZone / inZone", () => {
  it("accepts known zones and rejects junk", () => {
    expect(isValidTimeZone("Asia/Tokyo")).toBe(true);
    expect(isValidTimeZone("Not/AZone")).toBe(false);
    expect(isValidTimeZone("")).toBe(false);
    expect(isValidTimeZone(42)).toBe(false);
  });

  it("converts into a known zone and falls back to the browser's for an unknown one", () => {
    const at = Date.UTC(2026, 10, 20, 15, 0);
    expect(inZone(at, "Asia/Tokyo").format("YYYY-MM-DD HH:mm")).toBe("2026-11-21 00:00");
    expect(() => inZone(at, "Not/AZone")).not.toThrow();
    expect(inZone(at, "Not/AZone").valueOf()).toBe(at);
    expect(inZone(at, null).valueOf()).toBe(at);
  });
});
