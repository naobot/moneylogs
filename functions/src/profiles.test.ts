import { describe, it, expect } from "vite-plus/test";
import { publicProfile, sameProfile, sanitizeAvatar } from "./profiles";
import { normaliseAvatar } from "../../src/utils/avatar";

const blankRow = ".".repeat(30);
const inked = ["#".padEnd(30, "."), ...Array(29).fill(blankRow)];

describe("sanitizeAvatar", () => {
  it("keeps a drawn 30×30 avatar", () => {
    expect(sanitizeAvatar(inked)).toEqual(inked);
  });

  it("drops anything else", () => {
    for (const bad of [
      undefined,
      null,
      "###",
      Array(30).fill(blankRow),
      inked.slice(1),
      [...inked.slice(1), "x".repeat(30)],
      [...inked.slice(1), "#".repeat(31)],
    ]) {
      expect(sanitizeAvatar(bad)).toBeNull();
    }
  });

  it("agrees with the client's normaliseAvatar", () => {
    for (const value of [inked, Array(30).fill(blankRow), inked.slice(2), null]) {
      expect(sanitizeAvatar(value)).toEqual(normaliseAvatar(value));
    }
  });
});

describe("publicProfile", () => {
  it("projects only public fields", () => {
    const profile = publicProfile({
      displayName: " Mina ",
      displayLocation: "Kyoto",
      timezone: "Asia/Tokyo",
      email: "mina@example.com",
      avatar: inked,
      viewTracking: {},
    });
    expect(profile).toEqual({
      displayName: "Mina",
      displayLocation: "Kyoto",
      timezone: "Asia/Tokyo",
      avatar: inked,
    });
  });

  it("fills gaps with nulls", () => {
    expect(publicProfile({})).toEqual({
      displayName: "someone",
      displayLocation: null,
      timezone: null,
      avatar: null,
    });
  });
});

describe("sameProfile", () => {
  it("ignores non-public changes and catches public ones", () => {
    const a = publicProfile({ displayName: "Mina", avatar: inked, viewTracking: { x: 1 } });
    const b = publicProfile({ displayName: "Mina", avatar: inked, viewTracking: { x: 2 } });
    expect(sameProfile(a, b)).toBe(true);
    expect(sameProfile(a, publicProfile({ displayName: "Mina" }))).toBe(false);
    expect(sameProfile(a, publicProfile({ displayName: "Mia", avatar: inked }))).toBe(false);
  });
});
