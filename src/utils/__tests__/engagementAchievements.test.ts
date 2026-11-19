import { describe, it, expect } from "vite-plus/test";
import {
  ENGAGEMENT_ACHIEVEMENTS,
  isEngagementAchievementType,
} from "@/utils/engagementAchievements";

const [rules] = Object.values(
  import.meta.glob<string>("/firestore.rules", { query: "?raw", import: "default", eager: true }),
);

describe("engagement achievements", () => {
  it("can't be written by clients (firestore.rules lists every type)", () => {
    expect(rules).toBeTruthy();
    for (const type of Object.keys(ENGAGEMENT_ACHIEVEMENTS)) expect(rules).toContain(`"${type}"`);
  });

  it("tells engagement types from the others", () => {
    expect(isEngagementAchievementType("first_gift")).toBe(true);
    expect(isEngagementAchievementType("heart_leaf")).toBe(false);
    expect(isEngagementAchievementType("top_spender")).toBe(false);
    expect(isEngagementAchievementType("toString")).toBe(false);
  });
});
