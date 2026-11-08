import { describe, it, expect } from "vite-plus/test";
import {
  parseDeleteLogRequest,
  resolveCreator,
  storagePrefixes,
  uniqueDocIds,
  userFieldsToDelete,
} from "./deleteLogPlan";

describe("parseDeleteLogRequest", () => {
  it("accepts a known kind and a plain document id", () => {
    expect(parseDeleteLogRequest({ kind: "social", id: "abc123" })).toEqual({
      kind: "social",
      id: "abc123",
    });
    expect(parseDeleteLogRequest({ kind: "financial", id: "x_Y-9" })).toEqual({
      kind: "financial",
      id: "x_Y-9",
    });
  });

  it("rejects anything else, including path tricks", () => {
    for (const bad of [
      null,
      "x",
      {},
      { kind: "other", id: "a" },
      { kind: "social" },
      { kind: "social", id: "" },
      { kind: "social", id: "a/b" },
      { kind: "social", id: "../users" },
      { kind: "social", id: 5 },
    ]) {
      expect(parseDeleteLogRequest(bad)).toBeNull();
    }
  });
});

describe("resolveCreator", () => {
  it("prefers createdBy", () => {
    expect(resolveCreator("social", { createdBy: "u1" })).toBe("u1");
    expect(resolveCreator("financial", { createdBy: "u1", memberUids: ["u2"] })).toBe("u1");
  });

  it("falls back to the first member only for ledgers", () => {
    expect(resolveCreator("financial", { memberUids: ["u2", "u3"] })).toBe("u2");
    expect(resolveCreator("social", { memberUids: ["u2"] })).toBeUndefined();
    expect(resolveCreator("social", {})).toBeUndefined();
  });
});

describe("userFieldsToDelete", () => {
  it("lists every per-log user field plus each post's comment subscription", () => {
    expect(userFieldsToDelete("g1", ["p1", "p2"])).toEqual([
      "pinnedPosts.g1",
      "viewTracking.g1",
      "lastUpdated.g1",
      "archivedLogs.g1",
      "commentSubscriptions.p1",
      "commentSubscriptions.p2",
    ]);
  });
});

describe("uniqueDocIds", () => {
  it("merges member, subscriber and author refs without duplicates", () => {
    expect(
      uniqueDocIds(
        [{ id: "a" }, { id: "b" }],
        [{ id: "b" }, { id: "c" }],
        [undefined, null, { id: "" }],
      ),
    ).toEqual(["a", "b", "c"]);
  });
});

describe("storagePrefixes", () => {
  it("covers inline, processed and raw upload folders", () => {
    expect(storagePrefixes("g1")).toEqual(["inline/g1/", "images/g1/", "uploads/g1/"]);
  });
});
