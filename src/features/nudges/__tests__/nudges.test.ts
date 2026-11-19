import { describe, it, expect } from "vite-plus/test";
import { Timestamp } from "firebase/firestore";

import { nudgedFirst, nudgeId, nudgeSummary } from "../nudges";

describe("nudgeId", () => {
  it("keeps the direction, sender first", () => {
    expect(nudgeId("a", "b")).toBe("a__b");
    expect(nudgeId("b", "a")).toBe("b__a");
  });
});

describe("nudgeSummary", () => {
  it("counts pokes", () => {
    expect(nudgeSummary({ pokes: 1, cheer: null })).toBe("poked you");
    expect(nudgeSummary({ pokes: 7, cheer: null })).toBe("poked you ×7");
  });

  it("adds the cheer, or says only the cheer", () => {
    expect(nudgeSummary({ pokes: 3, cheer: "got_this" })).toBe("poked you ×3 · you've got this");
    expect(nudgeSummary({ pokes: 0, cheer: "proud" })).toBe("proud of you");
  });

  it("falls back to a poke for a retired cheer", () => {
    expect(nudgeSummary({ pokes: 0, cheer: "gone" })).toBe("poked you");
  });
});

describe("nudgedFirst", () => {
  const at = (ms: number) => ({ at: Timestamp.fromMillis(ms) });

  it("puts friends with something waiting first, latest first, and keeps the rest", () => {
    const nudges = new Map([
      ["c", at(100)],
      ["e", at(200)],
    ]);
    expect(nudgedFirst(["a", "b", "c", "d", "e"], nudges)).toEqual(["e", "c", "a", "b", "d"]);
  });

  it("changes nothing without nudges", () => {
    expect(nudgedFirst(["b", "a"], new Map())).toEqual(["b", "a"]);
  });
});
