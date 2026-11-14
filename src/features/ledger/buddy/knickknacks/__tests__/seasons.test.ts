import { describe, it, expect } from "vite-plus/test";
import { hemisphereOf, seasonOf } from "../seasons";
import { findableIn } from "../catalog";

describe("hemisphereOf", () => {
  it.each([
    ["Australia/Sydney", "south"],
    ["Pacific/Auckland", "south"],
    ["America/Argentina/Buenos_Aires", "south"],
    ["America/Santiago", "south"],
    ["Africa/Johannesburg", "south"],
    ["America/Toronto", "north"],
    ["Asia/Tokyo", "north"],
    ["Mars/Olympus_Mons", "north"],
  ])("%s → %s", (tz, hemisphere) => {
    expect(hemisphereOf(tz)).toBe(hemisphere);
  });

  it("counts a missing timezone as north", () => {
    expect(hemisphereOf(undefined)).toBe("north");
    expect(hemisphereOf(null)).toBe("north");
    expect(hemisphereOf("")).toBe("north");
  });
});

describe("seasonOf", () => {
  it("follows the northern calendar", () => {
    expect([1, 3, 6, 9, 12].map((m) => seasonOf(m))).toEqual([
      "winter",
      "spring",
      "summer",
      "autumn",
      "winter",
    ]);
  });

  it("is six months on in the south", () => {
    expect([1, 4, 7, 10].map((m) => seasonOf(m, "south"))).toEqual([
      "summer",
      "autumn",
      "winter",
      "spring",
    ]);
  });
});

describe("findableIn", () => {
  it("turns up the autumn set in a northern October", () => {
    expect(findableIn({ month: 10, timezone: "America/Toronto" }).sort()).toEqual([
      "acorn",
      "maple_leaf",
      "pinecone",
    ]);
  });

  it("keeps only the pinecone into winter", () => {
    expect(findableIn({ month: 1, timezone: "America/Toronto" })).toEqual(["pinecone"]);
  });

  it("flips for the southern hemisphere", () => {
    expect(findableIn({ month: 10, timezone: "Australia/Sydney" })).toEqual([]);
    expect(findableIn({ month: 1, timezone: "Australia/Sydney" })).toEqual([]);
    expect(findableIn({ month: 4, timezone: "Australia/Sydney" }).sort()).toEqual([
      "acorn",
      "maple_leaf",
      "pinecone",
    ]);
  });
});
