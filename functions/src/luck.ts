/**
 * Luck: how likely the budget buddy is to find a knick-knack. Pure rules for
 * knickknackFind.ts, free of the SDK for the root Vitest run.
 *
 * Luck is half spending habits (how the person's active financial logs are doing against
 * their budgets, or against recent months without one) and half momentum, which rises a
 * little with each day they drop by and slowly drains on days they don't. People only ever
 * see it as words (users/{id}/luck/current holds the tier); the numbers stay server-side,
 * in users/{id}/buddy/luck.
 */

import { COMFORTABLY_UNDER } from "./knickknacks";

/** Momentum gained on each new day with a check-in (any signed-in visit). */
export const MOMENTUM_GAIN = 0.06;
/** Extra momentum for the first logged entry of a day. */
export const MOMENTUM_ENTRY_GAIN = 0.04;
/** Momentum lost for each day missed between check-ins. */
export const MOMENTUM_DECAY = 0.08;
/** Momentum for someone with no check-in history. */
export const MOMENTUM_START = 0.3;
/** A check-in streak this long seeds full momentum (for people from before luck). */
export const STREAK_SEED_DAYS = 20;
/** Days with spending, out of the last 14, that make a log count towards luck. */
export const MIN_ACTIVE_DAYS = 3;

/** The chance on a roll with no luck at all, and with full luck. */
export const MIN_CHANCE = 0.04;
export const MAX_CHANCE = 0.15;

/** users/{id}/buddy/luck (server only). */
export type LuckState = {
  momentum?: number;
  /** The last day ("YYYY-MM-DD", the person's timezone) with a check-in. */
  lastDay?: string;
  /** The last day whose first logged entry gave its extra momentum. */
  entryDay?: string;
};

export const LUCK_TIERS = [
  "not_so_lucky",
  "a_little_lucky",
  "average",
  "pretty_lucky",
  "super_lucky",
] as const;
export type LuckTier = (typeof LUCK_TIERS)[number];

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

/** Whole days from one "YYYY-MM-DD" day to a later one. */
export const daysBetween = (from: string, to: string): number =>
  Math.round(
    (Date.UTC(+to.slice(0, 4), +to.slice(5, 7) - 1, +to.slice(8, 10)) -
      Date.UTC(+from.slice(0, 4), +from.slice(5, 7) - 1, +from.slice(8, 10))) /
      86_400_000,
  );

/**
 * Momentum after a check-in on `today` (and, with `entry`, a logged entry). A new day
 * first drains what the missed days cost, then adds the day's gain; the same day again
 * only adds the entry bonus, once. A day earlier than the last one (a timezone change)
 * changes nothing. Null when nothing changes.
 */
export const nextLuckState = ({
  state,
  today,
  entry = false,
  streakDays,
}: {
  state?: LuckState | null;
  today: string;
  entry?: boolean;
  /** The current check-in streak, to seed momentum for someone new to luck. */
  streakDays?: number;
}): Required<LuckState> | null => {
  let momentum =
    state?.momentum ?? (streakDays ? Math.min(1, streakDays / STREAK_SEED_DAYS) : MOMENTUM_START);
  let lastDay = state?.lastDay ?? "";
  let entryDay = state?.entryDay ?? "";
  let changed = state?.momentum === undefined;

  if (lastDay && today < lastDay) return changed ? { momentum, lastDay, entryDay } : null;
  if (today !== lastDay) {
    const missed = lastDay ? Math.max(0, daysBetween(lastDay, today) - 1) : 0;
    // Drained to no lower than nothing, then the day's gain: coming back always counts.
    momentum = clamp01(clamp01(momentum - MOMENTUM_DECAY * missed) + MOMENTUM_GAIN);
    lastDay = today;
    changed = true;
  }
  if (entry && entryDay !== today) {
    momentum = clamp01(momentum + MOMENTUM_ENTRY_GAIN);
    entryDay = today;
    changed = true;
  }
  return changed ? { momentum, lastDay, entryDay } : null;
};

/**
 * One log's spending grade from its pace ratio (spending ÷ the budget's share so far; see
 * budgetPaceRatio and historyPaceRatio): 1 comfortably under, sliding to 0.5 right on
 * pace, 0 once over. Null without a ratio, so the log doesn't count.
 */
export const spendingGrade = (paceRatio: number | null): number | null => {
  if (paceRatio === null) return null;
  if (paceRatio > 1) return 0;
  if (paceRatio <= COMFORTABLY_UNDER) return 1;
  return 1 - (paceRatio - COMFORTABLY_UNDER) / (1 - COMFORTABLY_UNDER) / 2;
};

/**
 * Spending habits across the person's active logs: the mean grade, leaving out logs
 * with too little recent spending (so a fresh, empty log with a huge budget can't prop
 * luck up) and logs with nothing to grade. Neutral (0.5) when no log counts.
 */
export const spendingScore = (
  logs: ReadonlyArray<{ loggedDays: number; grade: number | null }>,
): number => {
  const grades = logs
    .filter((l) => l.loggedDays >= MIN_ACTIVE_DAYS && l.grade !== null)
    .map((l) => l.grade as number);
  return grades.length ? grades.reduce((a, b) => a + b, 0) / grades.length : 0.5;
};

export const luckOf = ({ spending, momentum }: { spending: number; momentum: number }): number =>
  clamp01(0.5 * spending + 0.5 * momentum);

/** Luck in fifths, lowest first. */
export const luckTier = (luck: number): LuckTier =>
  LUCK_TIERS[Math.min(LUCK_TIERS.length - 1, Math.floor(clamp01(luck) * LUCK_TIERS.length))];

/**
 * The chance on one roll. After a find the same day, each later roll is scaled by luck²
 * per find, so a second find in a day is rare and needs high luck.
 */
export const rollChance = ({ luck, findsToday }: { luck: number; findsToday: number }): number =>
  (MIN_CHANCE + (MAX_CHANCE - MIN_CHANCE) * clamp01(luck)) *
  clamp01(luck) ** (2 * Math.max(0, findsToday));
