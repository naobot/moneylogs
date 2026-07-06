import { describe, it, expect } from "vite-plus/test";
import { needsProfileSetup, parseDocumentReference, parseReferenceArray } from "@/utils/helpers";

const makeRef = (segments: string[], offset = 0, len = 2) => ({
  _key: { path: { segments, offset, len } },
});

describe("parseDocumentReference", () => {
  it("extracts id, collection, and path from a standard ref", () => {
    const ref = makeRef(["users", "abc123"]);
    expect(parseDocumentReference(ref)).toEqual({
      id: "abc123",
      collection: "users",
      path: "users/abc123",
    });
  });

  it("applies offset to skip leading segments", () => {
    // Firestore sometimes stores full paths; offset points to the relevant pair
    const ref = makeRef(["projects", "p", "databases", "d", "log_groups", "group456"], 4, 2);
    expect(parseDocumentReference(ref)).toEqual({
      id: "group456",
      collection: "log_groups",
      path: "log_groups/group456",
    });
  });

  it("returns null for null input", () => {
    expect(parseDocumentReference(null)).toBeNull();
  });

  it("returns null when _key is absent", () => {
    expect(parseDocumentReference({})).toBeNull();
  });

  it("returns null when path is absent", () => {
    expect(parseDocumentReference({ _key: {} })).toBeNull();
  });

  it("returns null when segments is absent", () => {
    expect(parseDocumentReference({ _key: { path: {} } })).toBeNull();
  });

  it("defaults offset to 0 and len to 2 when not provided", () => {
    const ref = { _key: { path: { segments: ["log_posts", "post789"] } } };
    expect(parseDocumentReference(ref)).toEqual({
      id: "post789",
      collection: "log_posts",
      path: "log_posts/post789",
    });
  });
});

describe("parseReferenceArray", () => {
  it("maps valid refs to their parsed form", () => {
    const refs = [makeRef(["users", "u1"]), makeRef(["users", "u2"])];
    const result = parseReferenceArray(refs);
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ id: "u1", collection: "users", path: "users/u1" });
    expect(result[1]).toEqual({ id: "u2", collection: "users", path: "users/u2" });
  });

  it("filters out entries that fail to parse", () => {
    const refs = [makeRef(["users", "u1"]), null, {}, makeRef(["users", "u2"])];
    const result = parseReferenceArray(refs);
    expect(result).toHaveLength(2);
    expect(result.map((r) => r.id)).toEqual(["u1", "u2"]);
  });

  it("returns an empty array for empty input", () => {
    expect(parseReferenceArray([])).toEqual([]);
  });

  it("returns an empty array when all entries fail to parse", () => {
    expect(parseReferenceArray([null, {}, { _key: {} }])).toEqual([]);
  });
});

describe("needsProfileSetup", () => {
  it("is true for a logged-in user with no timezone", () => {
    expect(needsProfileSetup({ timezone: undefined })).toBe(true);
    expect(needsProfileSetup({ timezone: null })).toBe(true);
    expect(needsProfileSetup({})).toBe(true);
  });

  it("is false once a timezone has been set", () => {
    expect(needsProfileSetup({ timezone: "America/Toronto" })).toBe(false);
  });

  it("is false when there is no user to set up", () => {
    expect(needsProfileSetup(null)).toBe(false);
    expect(needsProfileSetup(undefined)).toBe(false);
  });
});
