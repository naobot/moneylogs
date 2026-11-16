import { describe, it, expect } from "vite-plus/test";
import { KNICK_KNACK_IDS, KNICK_KNACKS } from "../catalog";
import { isMilestoneAchievementType, MILESTONE_ACHIEVEMENTS } from "../milestoneAchievements";

const [rules] = Object.values(
  import.meta.glob<string>("/firestore.rules", { query: "?raw", import: "default", eager: true }),
);

const milestones = KNICK_KNACK_IDS.filter((id) => KNICK_KNACKS[id].rarity === "milestone");

describe("milestone achievements", () => {
  it("exist for every milestone knick-knack, and only those", () => {
    expect(Object.keys(MILESTONE_ACHIEVEMENTS).sort()).toEqual([...milestones].sort());
  });

  it("can't be written by clients (firestore.rules lists every type)", () => {
    expect(rules).toBeTruthy();
    for (const id of milestones) expect(rules).toContain(`"${id}"`);
  });

  it("tells milestone types from group ones", () => {
    expect(isMilestoneAchievementType("heart_leaf")).toBe(true);
    expect(isMilestoneAchievementType("top_spender")).toBe(false);
  });
});
