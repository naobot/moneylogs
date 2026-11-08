import { describe, it, expect } from "vite-plus/test";
import { spotsLeft } from "@/utils/ledger";

describe("spotsLeft", () => {
  it("counts remaining member slots", () => {
    expect(spotsLeft({ max_participants: 4, memberUids: ["a"] })).toBe(3);
  });

  it("never goes negative if a log is over capacity", () => {
    expect(spotsLeft({ max_participants: 1, memberUids: ["a", "b"] })).toBe(0);
  });
});
