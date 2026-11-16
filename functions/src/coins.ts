/**
 * Coin knick-knacks: pure rules for checkIn.ts, free of the SDK for root Vitest.
 *
 * Coins are milestone knick-knacks (milestones.ts): the buddy hands them over for habits. A copper coin for your first entry in a financial log (everyone's starter),
 * then silver, gold and extra shiny gold for checking in on a financial log so many days
 * in a row. A check-in is opening one of your financial logs, or logging an entry in one.
 * Days are counted in the person's own timezone (user.timezone). Each coin is given once,
 * with an achievement.
 */

import type { KnickKnackId } from "./knickknacks";

export const STARTER_COIN = "copper_coin" satisfies KnickKnackId;

/** Days in a row that earn each streak coin, shortest first. */
export const STREAK_COINS = [
  { item: "silver_coin", days: 10 },
  { item: "gold_coin", days: 30 },
  { item: "extra_shiny_gold_coin", days: 100 },
] as const satisfies ReadonlyArray<{ item: KnickKnackId; days: number }>;

export type CoinId = typeof STARTER_COIN | (typeof STREAK_COINS)[number]["item"];

/** users/{id}/buddy/streak */
export type StreakMarker = {
  /** The last day ("YYYY-MM-DD", the person's timezone) with a check-in. */
  lastDay?: string;
  /** Days in a row up to and including lastDay. */
  days?: number;
  /** Coins already given, so none is given twice. */
  coins?: string[];
};

/** The day before a "YYYY-MM-DD" day. */
export const dayBefore = (day: string): string =>
  new Date(Date.UTC(+day.slice(0, 4), +day.slice(5, 7) - 1, +day.slice(8, 10)) - 86_400_000)
    .toISOString()
    .slice(0, 10);

/**
 * The streak after a check-in on `today`: one more if the last check-in was yesterday,
 * back to one after a gap. The same day again changes nothing (null), and so does a day
 * earlier than the last one (a timezone change can make "today" go backwards).
 */
export const nextStreak = (
  marker: StreakMarker | undefined | null,
  today: string,
): { lastDay: string; days: number } | null => {
  const lastDay = marker?.lastDay;
  if (lastDay && today <= lastDay) return null;
  const days = lastDay && dayBefore(today) === lastDay ? (marker?.days ?? 0) + 1 : 1;
  return { lastDay: today, days };
};

/**
 * Coins due after a check-in that makes `days` in a row: the starter for a logged entry,
 * plus any streak coin reached, leaving out coins already given.
 */
export const coinsDue = ({
  days,
  given,
  loggedEntry,
}: {
  days: number;
  given: readonly string[];
  loggedEntry: boolean;
}): CoinId[] => {
  const due: CoinId[] = [];
  if (loggedEntry && !given.includes(STARTER_COIN)) due.push(STARTER_COIN);
  for (const { item, days: needed } of STREAK_COINS) {
    if (days >= needed && !given.includes(item)) due.push(item);
  }
  return due;
};

export const parseCheckInRequest = (data: unknown): { ledgerId: string } | null => {
  const ledgerId = (data as { ledgerId?: unknown } | null)?.ledgerId;
  return typeof ledgerId === "string" && /^[A-Za-z0-9_-]{1,128}$/.test(ledgerId)
    ? { ledgerId }
    : null;
};
