import { describe, it, expect } from "vite-plus/test";
import {
  FIRST_COMMENT_ON_OTHERS,
  FIRST_FRIEND,
  EARLY_TESTER,
  EARLY_TESTER_EXTRA,
  FIRST_INVITE,
  FIRST_SOCIAL_ENTRY,
  isCommentOnOthers,
  milestoneAchievementId,
} from "./milestones";
import { STARTER_COIN, STREAK_COINS } from "./coins";
import { findableIn, KNICK_KNACK_FINDS } from "./knickknacks";
import { giftBlock } from "./giftsPlan";
import { MILESTONE_ACHIEVEMENTS } from "../../src/features/ledger/buddy/knickknacks/milestoneAchievements";

const milestoneIds = Object.entries(KNICK_KNACK_FINDS)
  .filter(([, { rarity }]) => rarity === "milestone")
  .map(([id]) => id)
  .sort();

describe("milestones", () => {
  it("are exactly the coins and the one-offs", () => {
    expect(milestoneIds).toEqual(
      [
        STARTER_COIN,
        ...STREAK_COINS.map((c) => c.item),
        FIRST_SOCIAL_ENTRY,
        FIRST_COMMENT_ON_OTHERS,
        FIRST_FRIEND,
        FIRST_INVITE,
        EARLY_TESTER,
        EARLY_TESTER_EXTRA,
      ].sort(),
    );
  });

  it("each come with an achievement the app knows", () => {
    expect(Object.keys(MILESTONE_ACHIEVEMENTS).sort()).toEqual(milestoneIds);
  });

  it("leave special knick-knacks giftable and never found by chance", () => {
    expect(giftBlock({ seenAt: 1, source: "special", item: "mini_robot_charm" })).toBeNull();
    for (let month = 1; month <= 12; month++) {
      expect(findableIn({ month, timezone: "America/Toronto" })).not.toContain("mini_robot_charm");
    }
  });

  it("are never giftable", () => {
    expect(giftBlock({ seenAt: 1, source: "milestone", item: "heart_leaf" })).toBe("milestone");
  });

  it("use one fixed achievement id per item", () => {
    expect(milestoneAchievementId("paper_crane")).toBe("milestone__paper_crane");
  });

  it("only count comments on someone else's entry", () => {
    expect(isCommentOnOthers("u1", "u2")).toBe(true);
    expect(isCommentOnOthers("u1", "u1")).toBe(false);
    expect(isCommentOnOthers("u1", undefined)).toBe(false);
  });
});
