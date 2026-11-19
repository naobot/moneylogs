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

  it("blocks missing and unseen finds", () => {
    expect(giftBlock(undefined)).toBe("missing");
    expect(giftBlock({ item: "acorn", seenAt: null })).toBe("unseen");
  });

  it("lets opened gifts be passed on, from friends or the forest spirit", () => {
    expect(giftBlock({ item: "acorn", seenAt: seen, source: "gift", giftedBy: "mina" })).toBeNull();
    expect(
      giftBlock({ item: "acorn", seenAt: seen, source: "gift", giftedBy: FOREST_SPIRIT_ID }),
    ).toBeNull();
    expect(giftBlock({ item: "acorn", seenAt: null, source: "gift" })).toBe("unseen");
  });

  it("agrees with the client", () => {
    for (const f of [
      { seenAt: seen },
      { seenAt: null },
      { seenAt: seen, source: "gift" },
      { seenAt: seen, source: "found" },
      { seenAt: seen, source: "milestone" },
      { seenAt: seen, source: "special" },
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
