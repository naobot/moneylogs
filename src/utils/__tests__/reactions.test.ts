import { describe, it, expect } from "vite-plus/test";
import {
  canAddReaction,
  hasReacted,
  MAX_REACTIONS_PER_USER,
  reactorNames,
  summarizeReactions,
} from "@/utils/reactions";

describe("summarizeReactions", () => {
  it("returns nothing for missing or empty reactions", () => {
    expect(summarizeReactions(undefined)).toEqual([]);
    expect(summarizeReactions({})).toEqual([]);
    expect(summarizeReactions({ u1: [], u2: undefined })).toEqual([]);
  });

  it("tallies per emoji, most-used first, ties in first-seen order", () => {
    const result = summarizeReactions(
      { u1: ["👍", "🔥"], u2: ["🔥", "😂"], u3: ["🔥", "👍"] },
      "u2",
    );
    expect(result).toEqual([
      { emoji: "🔥", count: 3, mine: true, userIds: ["u1", "u2", "u3"] },
      { emoji: "👍", count: 2, mine: false, userIds: ["u1", "u3"] },
      { emoji: "😂", count: 1, mine: true, userIds: ["u2"] },
    ]);
  });

  it("counts a user once per emoji even if stored twice", () => {
    expect(summarizeReactions({ u1: ["👍", "👍"] })[0].count).toBe(1);
  });

  it("marks nothing as mine without a viewer", () => {
    expect(summarizeReactions({ u1: ["👍"] }).every((r) => !r.mine)).toBe(true);
  });
});

describe("hasReacted / canAddReaction", () => {
  it("knows whether a click adds or removes", () => {
    expect(hasReacted({ u1: ["👍"] }, "u1", "👍")).toBe(true);
    expect(hasReacted({ u1: ["👍"] }, "u2", "👍")).toBe(false);
    expect(hasReacted(undefined, "u1", "👍")).toBe(false);
  });

  it("caps reactions per user and rejects junk", () => {
    const full = { u1: Array.from({ length: MAX_REACTIONS_PER_USER }, (_, i) => `e${i}`) };
    expect(canAddReaction(full, "u1", "👍")).toBe(false);
    expect(canAddReaction(full, "u1", "e0")).toBe(true); // already there
    expect(canAddReaction(full, "u2", "👍")).toBe(true);
    expect(canAddReaction({}, "u1", "")).toBe(false);
    expect(canAddReaction({}, "u1", "x".repeat(40))).toBe(false);
    expect(canAddReaction({}, "u1", "👩🏽‍💻")).toBe(true);
  });
});

describe("reactorNames", () => {
  const names = new Map([
    ["u1", "ana"],
    ["u2", "ben"],
    ["u3", "cy"],
    ["u4", "dee"],
  ]);
  const nameOf = (id: string) => names.get(id);

  it("names everyone when there are few, calling the viewer you", () => {
    expect(reactorNames(["u1"], nameOf)).toBe("ana");
    expect(reactorNames(["u1", "u2"], nameOf, "u2")).toBe("ana and you");
    expect(reactorNames(["u1", "u2", "u9"], nameOf)).toBe("ana, ben and someone");
  });

  it("summarises the rest", () => {
    expect(reactorNames(["u1", "u2", "u3", "u4"], nameOf)).toBe("ana, ben, cy and 1 other");
    expect(reactorNames(["u1", "u2", "u3", "u4", "u5"], nameOf)).toBe("ana, ben, cy and 2 others");
  });
});
