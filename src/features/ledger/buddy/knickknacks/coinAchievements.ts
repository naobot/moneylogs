import type { KnickKnackId } from "./catalog";

/**
 * Each coin the buddy hands over comes with an achievement of the same type, written by
 * the server alongside the coin (functions/src/checkIn.ts) and shown with the coin's art.
 */
export const COIN_ACHIEVEMENTS = {
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
} as const satisfies Partial<Record<KnickKnackId, { title: string; description: string }>>;

export type CoinAchievementType = keyof typeof COIN_ACHIEVEMENTS;

export const isCoinAchievementType = (type: string): type is CoinAchievementType =>
  Object.hasOwn(COIN_ACHIEVEMENTS, type);
