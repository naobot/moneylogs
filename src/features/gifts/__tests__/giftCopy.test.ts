import { describe, it, expect } from "vite-plus/test";
import { giftLeftLine } from "../giftCopy";

describe("giftLeftLine", () => {
  it("says how many stay with you", () => {
    expect(giftLeftLine("acorn", 1)).toBe("it's your only acorn.");
    expect(giftLeftLine("acorn", 2)).toBe("you'll keep 1.");
    expect(giftLeftLine("acorn", 4)).toBe("you'll keep 3.");
  });
});
