import type { KnickKnackId } from "./catalog";

/**
 * Achievements that come with a milestone knick-knack, of the same type. The server
 * writes them alongside the knick-knack (functions/src/awardMilestone.ts), and they're
 * shown with its art. Only achievements that encourage healthy use of the app get one.
 */
export const MILESTONE_ACHIEVEMENTS = {
  copper_coin: {
    title: "First Coin",
    description: "Logged a first entry in a financial log",
  },
  silver_coin: {
    title: "Ten in a Row",
    description: "Checked in on a financial log 10 days in a row",
  },
  gold_coin: {
    title: "A Whole Month",
    description: "Checked in on a financial log 30 days in a row",
  },
  extra_shiny_gold_coin: {
    title: "One Hundred Days",
    description: "Checked in on a financial log 100 days in a row",
  },
  heart_leaf: {
    title: "Off We Go",
    description: "Logged a first entry in a social log",
  },
  paper_crane: {
    title: "Pen Pal",
    description: "Left a first comment on someone else's entry",
  },
  friendship_bracelet: {
    title: "Buddy System",
    description: "Made a first friend",
  },
} as const satisfies Partial<Record<KnickKnackId, { title: string; description: string }>>;

export type MilestoneAchievementType = keyof typeof MILESTONE_ACHIEVEMENTS;

export const isMilestoneAchievementType = (type: string): type is MilestoneAchievementType =>
  Object.hasOwn(MILESTONE_ACHIEVEMENTS, type);
