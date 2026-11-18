import { describe, it, expect } from "vite-plus/test";
import {
  canGift,
  FOREST_SPIRIT_ID,
  giftBlock,
  parseGiftRequest,
  spiritGiftBlock,
} from "./giftsPlan";
import { KNICK_KNACK_FINDS } from "./knickknacks";
import { isGiftable } from "../../src/features/ledger/buddy/knickknacks/gifts";

const seen = { toMillis: () => 1 };

describe("parseGiftRequest", () => {
  it("needs a find id and a recipient", () => {
    expect(parseGiftRequest({ findId: "f1", toUserDocId: "u2" })).toEqual({
      findId: "f1",
      toUserDocId: "u2",
    });
    for (const bad of [null, {}, { findId: "f1" }, { findId: "a/b", toUserDocId: "u" }]) {
      expect(parseGiftRequest(bad)).toBeNull();
    }
  });
});

describe("giftBlock", () => {
  it("allows seen finds the giver found", () => {
    expect(giftBlock({ item: "acorn", seenAt: seen })).toBeNull();
    expect(giftBlock({ item: "acorn", seenAt: seen, source: "found" })).toBeNull();
  });

  it("blocks missing, unseen and gifted finds", () => {
    expect(giftBlock(undefined)).toBe("missing");
    expect(giftBlock({ item: "acorn", seenAt: null })).toBe("unseen");
    expect(giftBlock({ item: "acorn", seenAt: seen, source: "gift" })).toBe("was_gift");
  });

  it("agrees with the client", () => {
    for (const f of [
      { seenAt: seen },
      { seenAt: null },
      { seenAt: seen, source: "gift" },
      { seenAt: seen, source: "found" },
    ]) {
      expect(isGiftable(f as never)).toBe(canGift(f));
    }
  });
});

describe("spiritGiftBlock", () => {
  it("sends found and special knick-knacks, never milestones or unknown items", () => {
    expect(spiritGiftBlock("acorn", KNICK_KNACK_FINDS)).toBeNull();
    expect(spiritGiftBlock("mini_robot_charm", KNICK_KNACK_FINDS)).toBeNull();
    expect(spiritGiftBlock("gold_coin", KNICK_KNACK_FINDS)).toBe("milestone");
    expect(spiritGiftBlock("unicorn", KNICK_KNACK_FINDS)).toBe("unknown");
  });
});

describe("forest spirit gifts", () => {
  it("can be passed on once opened, unlike a friend's", () => {
    const spirit = { item: "acorn", source: "gift", giftedBy: FOREST_SPIRIT_ID, seenAt: seen };
    expect(giftBlock(spirit)).toBeNull();
    expect(giftBlock({ ...spirit, seenAt: null })).toBe("unseen");
    expect(giftBlock({ ...spirit, giftedBy: "mina" })).toBe("was_gift");
    expect(isGiftable(spirit as never)).toBe(true);
    expect(isGiftable({ ...spirit, giftedBy: "mina" } as never)).toBe(false);
  });
});
