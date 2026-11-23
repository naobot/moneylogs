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
/**
 * Extra momentum for a rare confirmed no-spend day: the same as a logged day's, never more.
 * Days get less the more of them someone confirms (noSpendShare).
 */
export const NO_SPEND_GAIN = MOMENTUM_ENTRY_GAIN;
/** How far back noSpendShare looks for other confirmed no-spend days. */
export const NO_SPEND_WINDOW_DAYS = 30;
/** Each this many other confirmed no-spend days in the window halve a day's bonus. */
export const NO_SPEND_HALF_AT = 6;
/** The smallest share of the bonus a no-spend day ever gets. */
export const NO_SPEND_MIN_SHARE = 0.25;
/** A no-spend day only lifts luck for someone who logged an entry within this many days. */
export const NO_SPEND_RECENT_ENTRY_DAYS = 7;
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
  /** The confirmed no-spend day whose extra momentum is currently applied. */
  noSpendDay?: string;
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
  // Carried through untouched, so a later entry can still take a no-spend bonus back.
  const noSpendDay = state?.noSpendDay ?? "";
  let changed = state?.momentum === undefined;

  if (lastDay && today < lastDay) {
    return changed ? { momentum, lastDay, entryDay, noSpendDay } : null;
  }
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
  return changed ? { momentum, lastDay, entryDay, noSpendDay } : null;
};

/**
 * The share of NO_SPEND_GAIN a no-spend day earns, from how many other days the person
 * confirmed in the NO_SPEND_WINDOW_DAYS before it: all of it when they're rare, halving
 * every NO_SPEND_HALF_AT days (half at 6, a quarter at 12), and never under
 * NO_SPEND_MIN_SHARE. Someone who often has nothing to spend still gets a little each
 * time; an unusual quiet day counts for more.
 */
export const noSpendShare = (recentDays: number): number =>
  Math.max(NO_SPEND_MIN_SHARE, 0.5 ** (Math.max(0, recentDays) / NO_SPEND_HALF_AT));

/**
 * Momentum after confirming `today` as a no-spend day. It takes the place of a logged day's
 * bonus, so it's given once a day, never on a day that already had the entry bonus, and
 * only to someone who's logged an entry in the last week: confirming every day without ever
 * logging earns nothing. The bonus is scaled by noSpendShare(recentDays). `rewarded` says
 * whether it was given and `gain` how much (to take back the same amount); `next` is null
 * when nothing changes.
 */
export const applyNoSpend = ({
  state,
  today,
  recentDays = 0,
}: {
  state?: LuckState | null;
  today: string;
  /** Other confirmed no-spend days in the NO_SPEND_WINDOW_DAYS before today. */
  recentDays?: number;
}): { next: LuckState | null; rewarded: boolean; gain: number } => {
  const none = { next: null, rewarded: false, gain: 0 };
  if (!state || typeof state.momentum !== "number") return none;
  if (state.noSpendDay === today || state.entryDay === today) return none;
  const sinceEntry = state.entryDay ? daysBetween(state.entryDay, today) : Infinity;
  if (sinceEntry < 0 || sinceEntry > NO_SPEND_RECENT_ENTRY_DAYS) return none;
  const gain = NO_SPEND_GAIN * noSpendShare(recentDays);
  return {
    next: { ...state, momentum: clamp01(state.momentum + gain), noSpendDay: today },
    rewarded: true,
    gain,
  };
};

/**
 * Momentum after an entry turns up on a confirmed no-spend `day`: the day's bonus comes
 * back off. Null when that day's bonus isn't the one applied.
 */
export const undoNoSpend = ({
  state,
  day,
  gain = NO_SPEND_GAIN,
}: {
  state?: LuckState | null;
  day: string;
  /** What the day gave (its doc's `gain`); days from before weighting gave the full bonus. */
  gain?: number;
}): LuckState | null => {
  if (!state || state.noSpendDay !== day || typeof state.momentum !== "number") return null;
  return { ...state, momentum: clamp01(state.momentum - gain), noSpendDay: "" };
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
