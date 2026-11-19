import { describe, it, expect } from "vite-plus/test";
import {
  addedMemberIds,
  ENGAGEMENT_ACHIEVEMENTS,
  engagementAchievementId,
  engagementNotificationId,
  engagementTitle,
} from "./engagement";
import { ENGAGEMENT_ACHIEVEMENTS as CLIENT } from "../../src/utils/engagementAchievements";
import { MILESTONE_ACHIEVEMENTS } from "../../src/features/ledger/buddy/knickknacks/milestoneAchievements";

const ref = (id: string) => ({ id, path: `users/${id}` });

describe("engagement achievements", () => {
  it("match the app's catalog", () => {
    expect(Object.keys(ENGAGEMENT_ACHIEVEMENTS).sort()).toEqual(Object.keys(CLIENT).sort());
    for (const [type, { title, description }] of Object.entries(ENGAGEMENT_ACHIEVEMENTS)) {
      expect(CLIENT[type as keyof typeof CLIENT]).toMatchObject({ title, description });
    }
  });

  it("don't share a type with a milestone", () => {
    for (const type of Object.keys(ENGAGEMENT_ACHIEVEMENTS)) {
      expect(Object.keys(MILESTONE_ACHIEVEMENTS)).not.toContain(type);
    }
  });

  it("have one fixed achievement and notification id per type", () => {
    expect(engagementAchievementId("first_gift")).toBe("engagement__first_gift");
    expect(engagementNotificationId("super_lucky")).toBe("achievement_super_lucky");
  });

  it("titles known types only", () => {
    expect(engagementTitle("first_social_log")).toBe("Joined In");
    expect(engagementTitle("from_the_future")).toBeNull();
    expect(engagementTitle("toString")).toBeNull();
    expect(engagementTitle(undefined)).toBeNull();
  });
});

describe("addedMemberIds", () => {
  it("lists members after a write who weren't there before", () => {
    expect(addedMemberIds([ref("a")], [ref("a"), ref("b")])).toEqual(["b"]);
  });

  it("counts everyone on a new log, the creator included", () => {
    expect(addedMemberIds(undefined, [ref("a")])).toEqual(["a"]);
  });

  it("finds no one when members didn't grow", () => {
    expect(addedMemberIds([ref("a"), ref("b")], [ref("b"), ref("a")])).toEqual([]);
    expect(addedMemberIds([ref("a"), ref("b")], [ref("a")])).toEqual([]);
    expect(addedMemberIds([ref("a")], undefined)).toEqual([]);
  });

  it("ignores entries that aren't references", () => {
    expect(addedMemberIds([], [null, "a", { id: "" }, { id: 3 }, ref("c")])).toEqual(["c"]);
  });
});
