/**
 * One-off backfill of milestone knick-knacks for people who earned them before they
 * existed (scripts/backfill-milestones.ts). Pure rules, free of the SDK for root Vitest.
 *
 * Check-ins weren't recorded before the coins, so the streak coins are backfilled from
 * the days people logged financial entries (by createdAt, in their timezone; an entry's
 * own date can be backdated). That only counts days with an entry, so it can only
 * under-count a streak, never over-count it.
 */

import { coinsDue, dayBefore, STARTER_COIN, StreakMarker, STREAK_COINS } from "./coins";
import { FIRST_COMMENT_ON_OTHERS, FIRST_FRIEND, FIRST_SOCIAL_ENTRY } from "./milestones";

const COIN_IDS = new Set<string>([STARTER_COIN, ...STREAK_COINS.map((c) => c.item)]);

export type PastActivity = {
  /** Days ("YYYY-MM-DD", their timezone) they created a financial entry on. */
  entryDays: readonly string[];
  wroteSocialEntry: boolean;
  commentedOnOthers: boolean;
  hasFriend: boolean;
};

/** Every day from a marker's streak: `days` days ending on `lastDay`. */
export const markerDays = (marker: StreakMarker | undefined | null): string[] => {
  const out: string[] = [];
  let day = marker?.lastDay;
  for (let i = 0; day && i < (marker?.days ?? 0); i++) {
    out.push(day);
    day = dayBefore(day);
  }
  return out;
};

/** Days in a row ending on `day`, within `days`. */
const runEndingOn = (days: ReadonlySet<string>, day: string): number => {
  let n = 0;
  for (let d = day; days.has(d); d = dayBefore(d)) n++;
  return n;
};

/** The longest stretch of consecutive days. */
export const longestRun = (days: Iterable<string>): number => {
  const set = new Set(days);
  let best = 0;
  // Only count from the last day of each run, so each run is walked once.
  for (const day of set) {
    const next = new Date(Date.parse(`${day}T00:00:00Z`) + 86_400_000).toISOString().slice(0, 10);
    if (!set.has(next)) best = Math.max(best, runEndingOn(set, day));
  }
  return best;
};

/**
 * What one person should get: the milestones they've earned and don't hold yet, and
 * their streak marker with past entries folded in (so a streak that's still going keeps
 * counting from where it really started). `held` is the milestone items they already
 * have achievements for.
 */
export const planBackfill = ({
  activity,
  held,
  marker,
}: {
  activity: PastActivity;
  held: ReadonlySet<string>;
  marker: StreakMarker | undefined | null;
}): { items: string[]; marker: StreakMarker | null } => {
  const days = new Set([...activity.entryDays, ...markerDays(marker)]);
  const given = [...new Set([...(marker?.coins ?? []), ...held])];
  const coins = coinsDue({
    days: longestRun(days),
    given,
    loggedEntry: activity.entryDays.length > 0,
  });

  const oneOffs = [
    activity.wroteSocialEntry && FIRST_SOCIAL_ENTRY,
    activity.commentedOnOthers && FIRST_COMMENT_ON_OTHERS,
    activity.hasFriend && FIRST_FRIEND,
  ].filter((item): item is string => !!item && !held.has(item));

  // The marker carries on from its own last day if it has one, otherwise from the last
  // day with an entry. A gap before today is fine: the next check-in starts over.
  const lastDay = marker?.lastDay ?? [...days].sort().pop();
  const nextMarker: StreakMarker | null = lastDay
    ? {
        lastDay,
        days: runEndingOn(days, lastDay),
        // Every coin they hold, so a live check-in never gives one again.
        coins: [...given.filter((item) => COIN_IDS.has(item)), ...coins],
      }
    : null;
  const changed =
    !!nextMarker &&
    (nextMarker.lastDay !== marker?.lastDay ||
      nextMarker.days !== marker?.days ||
      nextMarker.coins!.length !== (marker?.coins ?? []).length);

  return { items: [...coins, ...oneOffs], marker: changed ? nextMarker : null };
};
