import type { IconType } from "@/components/Icon";

/**
 * Plain achievements (no knick-knack) for a first go at something the app offers. The
 * server writes them (functions/src/awardEngagement.ts) with an `achievement_earned`
 * notification; firestore.rules keeps clients from writing them. Mirrors
 * functions/src/engagement.ts, which a test keeps in step.
 */
export const ENGAGEMENT_ACHIEVEMENTS = {
  first_gift: {
    title: "Gift Giver",
    description: "Gave a friend a first gift",
    icon: "gift",
  },
  first_no_spend_day: {
    title: "Nothing Spent",
    description: "Confirmed a first no-spend day",
    icon: "wallet",
  },
  super_lucky: {
    title: "Super Lucky!",
    description: "Felt super lucky for the first time",
    icon: "star",
  },
  first_social_log: {
    title: "Joined In",
    description: "Started or joined a first social log",
    icon: "social",
  },
} as const satisfies Record<string, { title: string; description: string; icon: IconType }>;

export type EngagementAchievementType = keyof typeof ENGAGEMENT_ACHIEVEMENTS;

export const isEngagementAchievementType = (type: unknown): type is EngagementAchievementType =>
  typeof type === "string" && Object.hasOwn(ENGAGEMENT_ACHIEVEMENTS, type);
