import dayjs from "@/utils/configuredDayjs";
import { Currency } from "@/types/user";
import { CurrencyAmounts, LedgerCategory, LedgerMonth } from "@/types/ledger";
import { CURRENCIES } from "@/utils/currency";
import { budgetSummary, budgetsFor, buildInsights, elapsedDays } from "@/utils/ledgerStats";
import { BuddyMood, MOOD_SCALE, ScaleMood } from "./faces";

/** The buddy sleeps from 23:00 until 07:00 in the viewer's own timezone. */
export const BUDDY_SLEEP_FROM = 23;
export const BUDDY_WAKE_AT = 7;

export const isBuddyAsleep = (localHour: number): boolean =>
  localHour >= BUDDY_SLEEP_FROM || localHour < BUDDY_WAKE_AT;

/** What the speech bubble can talk about. */
export type BuddyFacts = {
  currency?: Currency;
  hasBudget: boolean;
  /** Share of the budget spent, 0–1+ (budgeted months). */
  used?: number;
  budget?: number;
  spent?: number;
  projected?: number | null;
  daysLeft: number;
  /** This month so far vs the same point last month, as a fraction (+0.2 = 20% more). */
  change?: number | null;
  /** Days in a row, up to today, with nothing spent. */
  noSpendDays: number;
  topCategory?: string;
};

export type BuddyState = {
  mood: BuddyMood;
  asleep: boolean;
  facts: BuddyFacts;
  /** Stable for the day: picks faces and lines, and jitters the thresholds a little. */
  seed: number;
};

/** A small string hash (FNV-1a), for picks that stay put all day. */
export const daySeed = (ledgerId: string, today: string): number => {
  let h = 0x811c9dc5;
  for (const ch of `${ledgerId}:${today}`) {
    h ^= ch.codePointAt(0)!;
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
};

/** ±0.05, fixed for the day: the buddy has its moods. */
const jitterOf = (seed: number) => (((seed % 1000) / 1000) * 2 - 1) * 0.05;

const step = (mood: ScaleMood, by: number): ScaleMood => {
  const i = MOOD_SCALE.indexOf(mood) + by;
  return MOOD_SCALE[Math.max(0, Math.min(MOOD_SCALE.length - 1, i))];
};

/** Budgeted months: how fast the budget is going relative to how much month has gone. */
export const moodForPace = (pace: number, jitter = 0): ScaleMood => {
  const p = pace + jitter;
  if (p > 1.25) return "worried";
  if (p > 1.05) return "wary";
  if (p > 0.8) return "content";
  if (p > 0.5) return "happy";
  return "delighted";
};

/** No budget: spending so far against the same point last month. */
export const moodForChange = (change: number, jitter = 0): ScaleMood => {
  const c = change + jitter;
  if (c > 0.3) return "worried";
  if (c > 0.1) return "wary";
  if (c > -0.1) return "content";
  if (c > -0.3) return "happy";
  return "delighted";
};

/** Days in a row, ending today, with nothing spent in any currency. */
export const noSpendStreak = (byDay: LedgerMonth["byDay"] | undefined, elapsed: number): number => {
  let streak = 0;
  for (let day = elapsed; day >= 1; day--) {
    const amounts = byDay?.[String(day).padStart(2, "0")];
    if (amounts && Object.values(amounts).some((v) => (v ?? 0) > 0)) break;
    streak++;
  }
  return streak;
};

const largest = (totals: CurrencyAmounts): Currency | undefined =>
  CURRENCIES.filter((c) => (totals[c] ?? 0) > 0).sort(
    (a, b) => (totals[b] ?? 0) - (totals[a] ?? 0),
  )[0];

/**
 * The buddy's mood for the current month. Deliberately not a straight read-out of the
 * numbers:
 * - thresholds wobble a little day to day;
 * - a few no-spend days in a row cheer it up a step;
 * - it only gets properly delighted once the month is a few days in.
 * Over budget is always alarming, though.
 */
export const buddyMood = ({
  ledgerId,
  categories,
  current,
  previous,
  today,
  localHour,
}: {
  ledgerId: string;
  categories: ReadonlyArray<LedgerCategory>;
  current?: LedgerMonth | null;
  previous?: LedgerMonth | null;
  /** "YYYY-MM-DD" in the viewer's timezone. */
  today: string;
  localHour: number;
}): BuddyState => {
  const month = today.slice(0, 7);
  const seed = daySeed(ledgerId, today);
  const asleep = isBuddyAsleep(localHour);
  const days = dayjs(`${month}-01`).daysInMonth();
  const elapsed = Math.max(1, elapsedDays(month, today));
  const daysLeft = days - elapsed + 1;

  const totals = current?.totals ?? {};
  const agg = current ?? { entryCount: 0, totals: {}, byCategory: {}, byMember: {}, byDay: {} };

  // Every budgeted currency, worst pace first.
  const budgeted = CURRENCIES.flatMap((currency) => {
    if (budgetsFor(categories, currency).total <= 0) return [];
    const summary = budgetSummary({ month, today, currency, agg, categories });
    if (!summary) return [];
    const pace = summary.used / Math.max(elapsed / days, 1 / days);
    return [{ currency, summary, pace }];
  }).sort((a, b) => Number(b.summary.over) - Number(a.summary.over) || b.pace - a.pace);

  const focus = budgeted[0]?.currency ?? largest(totals);
  const insights = focus
    ? buildInsights({ month, today, currency: focus, agg, previous, categories })
    : null;

  const facts: BuddyFacts = {
    currency: focus,
    hasBudget: budgeted.length > 0,
    daysLeft,
    noSpendDays: noSpendStreak(current?.byDay, elapsed),
    change: insights?.vsLastMonth?.change ?? null,
    topCategory: insights?.topCategory?.name,
  };

  if (!current?.entryCount && !budgeted.some((b) => b.summary.spent > 0)) {
    return { mood: "idle", asleep, facts, seed };
  }

  const jitter = jitterOf(seed);
  let mood: ScaleMood;
  if (budgeted.length) {
    const { summary, pace } = budgeted[0];
    Object.assign(facts, {
      used: summary.used,
      budget: summary.budget,
      spent: summary.spent,
      projected: summary.projected,
    });
    if (summary.over) {
      return { mood: "alarmed", asleep, facts, seed };
    }
    mood = moodForPace(pace, jitter);
    // Too early in the month to be sure it's going that well.
    if (mood === "delighted" && elapsed < 3) mood = "happy";
  } else {
    facts.spent = focus ? (totals[focus] ?? 0) : 0;
    mood = typeof facts.change === "number" ? moodForChange(facts.change, jitter) : "content";
  }

  // A few days in a row without spending puts it in a better mood.
  if (facts.noSpendDays >= 3) mood = step(mood, 1);

  return { mood, asleep, facts, seed };
};
