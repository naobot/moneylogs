import { describe, it, expect } from "vite-plus/test";
import {
  buildPlaceIndex,
  CityData,
  nextDisplayLocation,
  normalise,
  Place,
  placeDetail,
  placeLabel,
  searchPlaces,
} from "@/utils/citySearch";
import realData from "@/data/cities.json";

const fixture: CityData = {
  v: 1,
  tz: ["Asia/Tokyo", "Europe/Zurich", "America/Chicago", "America/New_York", "Asia/Shanghai"],
  regions: ["Tokyo", "Kyoto", "Zurich", "Illinois", "Massachusetts", "Shaanxi"],
  countries: { JP: "Japan", CH: "Switzerland", US: "United States", CN: "China" },
  // Population order, as the build script writes it.
  rows: [
    ["Tokyo", "JP", 0, 0],
    ["Xi’an", "CN", 5, 4],
    ["Kyoto", "JP", 1, 0],
    ["Zürich", "CH", 2, 1],
    ["Springfield", "US", 3, 2],
    ["Springfield", "US", 4, 3],
    ["West Springfield", "US", 4, 3],
    ["Kyotanabe", "JP", 1, 0],
  ],
};
const index = buildPlaceIndex(fixture, ["UTC", "Europe/Paris", "Asia/Tokyo"]);
const names = (places: Place[]) => places.map((p) => `${p.name}|${p.region ?? ""}`);

describe("normalise", () => {
  it("folds case, accents, apostrophes and separators", () => {
    expect(normalise("Zürich")).toBe("zurich");
    expect(normalise("Xi’an")).toBe("xian");
    expect(normalise("Saint-Étienne")).toBe("saint etienne");
    expect(normalise("Łódź")).toBe("lodz");
    expect(normalise("America/Argentina/Buenos_Aires")).toBe("america argentina buenos aires");
  });
});

describe("searchPlaces", () => {
  it("returns nothing for an empty query", () => {
    expect(searchPlaces(index, "  ")).toEqual([]);
  });

  it("ranks exact over prefix and keeps population order within a rank", () => {
    expect(names(searchPlaces(index, "kyot"))).toEqual(["Kyoto|Kyoto", "Kyotanabe|Kyoto"]);
    expect(names(searchPlaces(index, "kyotanabe"))[0]).toBe("Kyotanabe|Kyoto");
  });

  it("puts word-prefix matches after name-prefix matches", () => {
    expect(names(searchPlaces(index, "springfield"))).toEqual([
      "Springfield|Illinois",
      "Springfield|Massachusetts",
      "West Springfield|Massachusetts",
    ]);
  });

  it("matches without accents or apostrophes", () => {
    expect(searchPlaces(index, "zurich")[0]).toMatchObject({
      name: "Zürich",
      timezone: "Europe/Zurich",
    });
    expect(searchPlaces(index, "xian")[0]).toMatchObject({ name: "Xi’an" });
  });

  it("narrows by region, country or country code after a comma", () => {
    expect(names(searchPlaces(index, "springfield, mass"))).toEqual([
      "Springfield|Massachusetts",
      "West Springfield|Massachusetts",
    ]);
    expect(names(searchPlaces(index, "springfield, illinois"))).toEqual(["Springfield|Illinois"]);
    expect(searchPlaces(index, "kyoto, jp")).toHaveLength(1);
    expect(searchPlaces(index, "kyoto, china")).toEqual([]);
  });

  it("falls back to IANA zones", () => {
    expect(searchPlaces(index, "utc")).toEqual([{ kind: "zone", name: "UTC", timezone: "UTC" }]);
    expect(searchPlaces(index, "paris")).toEqual([
      { kind: "zone", name: "Europe/Paris", timezone: "Europe/Paris" },
    ]);
    // Cities come before the zone of the same name.
    expect(searchPlaces(index, "tokyo").map((p) => p.kind)).toEqual(["city", "zone"]);
  });

  it("respects the limit", () => {
    expect(searchPlaces(index, "s", 2)).toHaveLength(2);
  });
});

describe("labels", () => {
  const kyoto = searchPlaces(index, "kyoto")[0];
  const zone: Place = { kind: "zone", name: "UTC", timezone: "UTC" };

  it("labels cities with their country and zones by id", () => {
    expect(placeLabel(kyoto)).toBe("Kyoto, Japan");
    expect(placeDetail(kyoto)).toBe("Kyoto, Japan");
    expect(placeLabel(zone)).toBe("UTC");
    expect(placeDetail(zone)).toBe("timezone");
  });
});

describe("nextDisplayLocation", () => {
  const kyoto = searchPlaces(index, "kyoto")[0];
  const tokyo = searchPlaces(index, "tokyo")[0];

  it("fills a blank location", () => {
    expect(nextDisplayLocation("", undefined, kyoto)).toBe("Kyoto, Japan");
    expect(nextDisplayLocation("  ", undefined, kyoto)).toBe("Kyoto, Japan");
  });

  it("follows the pick while the location is still our suggestion", () => {
    expect(nextDisplayLocation("Kyoto, Japan", "Kyoto, Japan", tokyo)).toBe("Tokyo, Japan");
  });

  it("keeps what the user wrote", () => {
    expect(nextDisplayLocation("Kansai", "Kyoto, Japan", tokyo)).toBe("Kansai");
    expect(nextDisplayLocation("Kansai", undefined, tokyo)).toBe("Kansai");
  });

  it("leaves the location alone when a bare zone is picked", () => {
    expect(nextDisplayLocation("", undefined, { kind: "zone", name: "UTC", timezone: "UTC" })).toBe(
      "",
    );
  });
});

describe("the bundled place list", () => {
  const real = buildPlaceIndex(realData as unknown as CityData);

  it("finds big cities first, with working timezones", () => {
    expect(searchPlaces(real, "tokyo")[0]).toMatchObject({
      country: "Japan",
      timezone: "Asia/Tokyo",
    });
    expect(searchPlaces(real, "london")[0]).toMatchObject({
      country: "United Kingdom",
      timezone: "Europe/London",
    });
    expect(searchPlaces(real, "springfield, illinois")[0]).toMatchObject({
      timezone: "America/Chicago",
    });
  });

  it("only uses zones the runtime can resolve", () => {
    for (const tz of (realData as unknown as CityData).tz) {
      expect(() => new Intl.DateTimeFormat("en", { timeZone: tz })).not.toThrow();
    }
  });
});
