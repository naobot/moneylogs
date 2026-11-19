import dayjs from "@/utils/configuredDayjs";
import { Currency } from "@/types/user";
import { LedgerCategory, LedgerEntry } from "@/types/ledger";
import { resolveCategory, shiftMonth } from "@/utils/ledger";
import { isFixedCategory } from "@/utils/ledgerCategories";
import {
  aggregateEntries,
  budgetSummary,
  categoryShares,
  spentThroughDay,
} from "@/utils/ledgerStats";
import { confirmedNoSpendStreak } from "@/features/ledger/buddy/buddyMood";
import { FACES, pick } from "@/features/ledger/buddy/faces";
import { KNICK_KNACK_IDS, KnickKnackId } from "@/features/ledger/buddy/knickknacks/catalog";
import type { KnickKnackFind } from "@/features/ledger/buddy/knickknacks/useUnseenFinds";

/**
 * What a share card says. Brags only, and never an amount: ratios, percentages and counts.
 * Everything here is about the sharer's own entries in one financial log, so it says "I".
 */

export type ShareLineKind = "usual_day" | "no_spend" | "month_pace" | "budget" | "kept_up";

export type ShareLine = { kind: ShareLineKind; text: string };

/** How many lines a card holds. */
export const MAX_SHARE_LINES = 3;

/** Same weekday, this many weeks back, makes "a usual Saturday". */
export const USUAL_DAY_WEEKS = 8;
/** Fewer usable weeks than this and there's no "usual" to speak of. */
export const USUAL_DAY_MIN_WEEKS = 4;

/** Months of entries the cards read: this one and the two before (covers 8 weeks back). */
export const SHARE_MONTHS = 3;

/** Month keys to load for `today`, oldest first. */
export const shareMonths = (today: string): string[] => {
  const month = today.slice(0, 7);
  return Array.from({ length: SHARE_MONTHS }, (_, i) => shiftMonth(month, i - SHARE_MONTHS + 1));
};

const dailyTotals = (entries: ReadonlyArray<LedgerEntry>, currency: Currency) => {
  const byDate = new Map<string, number>();
  for (const e of entries) {
    if (e.currency !== currency) continue;
    byDate.set(e.date, (byDate.get(e.date) ?? 0) + e.amount);
  }
  return byDate;
};

/** Round down to a step, so a brag never overstates. */
const floorTo = (value: number, step: number) => Math.floor(value / step + 1e-9) * step;

/** "3×", "2.5×": whole steps from 3 up, half steps below. */
export const formatTimes = (ratio: number): string => {
  const n = ratio >= 3 ? floorTo(ratio, 1) : floorTo(ratio, 0.5);
  return `${Number.isInteger(n) ? n : n.toFixed(1)}×`;
};

/**
 * Today against the same weekday over the last USUAL_DAY_WEEKS weeks. Only weeks since the
 * first entry count (before that there was no logging to compare with). Spending more than
 * usual says nothing; spending nothing only counts on a confirmed no-spend day, because an
 * unlogged day might just be a forgotten one.
 */
export const usualDayLine = ({
  byDate,
  firstDate,
  today,
  confirmedToday,
}: {
  byDate: ReadonlyMap<string, number>;
  firstDate: string | null;
  today: string;
  confirmedToday: boolean;
}): ShareLine | null => {
  if (!firstDate) return null;
  const base = dayjs(today);
  const weekday = base.format("dddd");
  const past = Array.from({ length: USUAL_DAY_WEEKS }, (_, i) =>
    base.subtract(7 * (i + 1), "day").format("YYYY-MM-DD"),
  ).filter((d) => d >= firstDate);
  if (past.length < USUAL_DAY_MIN_WEEKS) return null;
  const usual = past.reduce((sum, d) => sum + (byDate.get(d) ?? 0), 0) / past.length;
  if (usual <= 0) return null;

  const spent = byDate.get(today) ?? 0;
  if (spent <= 0) {
    return confirmedToday
      ? { kind: "usual_day", text: `Spent nothing on a ${weekday}, when I usually do!` }
      : null;
  }
  const ratio = usual / spent;
  if (ratio >= 1.5) {
    return {
      kind: "usual_day",
      text: `I spent ${formatTimes(ratio)} less than on a usual ${weekday}!`,
    };
  }
  const percentLess = floorTo((1 - spent / usual) * 100, 5);
  return percentLess >= 15
    ? { kind: "usual_day", text: `I spent ${percentLess}% less than on a usual ${weekday}!` }
    : null;
};

export const noSpendLine = (days: ReadonlySet<string>, today: string): ShareLine | null => {
  if (!days.has(today)) return null;
  const streak = confirmedNoSpendStreak(days, today);
  return streak >= 2
    ? { kind: "no_spend", text: `${streak} no-spend days in a row!` }
    : { kind: "no_spend", text: "Nothing spent today ✓" };
};

/**
 * This month so far against the same point last month. Needs logging from the start of
 * last month (a late start would make last month look small), and a real drop.
 */
export const monthPaceLine = ({
  entries,
  firstDate,
  today,
  currency,
}: {
  entries: ReadonlyArray<LedgerEntry>;
  firstDate: string | null;
  today: string;
  currency: Currency;
}): ShareLine | null => {
  const month = today.slice(0, 7);
  const lastMonth = shiftMonth(month, -1);
  if (!firstDate || firstDate > `${lastMonth}-03`) return null;
  const day = Number(today.slice(8, 10));
  const lastDays = dayjs(`${lastMonth}-01`).daysInMonth();
  const current = spentThroughDay(
    aggregateEntries(entries.filter((e) => e.month === month)).byDay,
    currency,
    day,
  );
  const previous = spentThroughDay(
    aggregateEntries(entries.filter((e) => e.month === lastMonth)).byDay,
    currency,
    Math.min(day, lastDays),
  );
  if (previous <= 0) return null;
  const percentLess = floorTo((1 - current / previous) * 100, 5);
  return percentLess >= 10
    ? { kind: "month_pace", text: `${percentLess}% less than this point last month` }
    : null;
};

/**
 * On track to stay under the month's budget. Budgets are for the whole log, so this is
 * only said when the sharer is its only member (their entries are all of it).
 */
export const budgetLine = ({
  entries,
  today,
  currency,
  categories,
  isSoleMember,
}: {
  entries: ReadonlyArray<LedgerEntry>;
  today: string;
  currency: Currency;
  categories: ReadonlyArray<LedgerCategory>;
  isSoleMember: boolean;
}): ShareLine | null => {
  if (!isSoleMember) return null;
  const month = today.slice(0, 7);
  const summary = budgetSummary({
    month,
    today,
    currency,
    agg: aggregateEntries(entries.filter((e) => e.month === month)),
    categories,
  });
  if (!summary || summary.over || summary.projected === null) return null;
  return summary.projected <= summary.budget
    ? { kind: "budget", text: "On track to stay under budget this month" }
    : null;
};

/**
 * The daily summary's lines, best first, at most MAX_SHARE_LINES. When nothing else
 * qualifies but the person logged or confirmed today, a modest "kept my log up" line;
 * otherwise none (the card has nothing honest to say yet).
 */
export const shareLines = ({
  entries,
  myUid,
  today,
  currency,
  categories,
  noSpendDays,
  isSoleMember,
}: {
  entries: ReadonlyArray<LedgerEntry>;
  myUid: string;
  today: string;
  currency: Currency;
  categories: ReadonlyArray<LedgerCategory>;
  noSpendDays: ReadonlySet<string>;
  isSoleMember: boolean;
}): ShareLine[] => {
  const mine = entries.filter((e) => e.authorUid === myUid && e.date <= today);
  const firstDate = mine.reduce<string | null>(
    (first, e) => (first === null || e.date < first ? e.date : first),
    null,
  );
  const confirmedToday = noSpendDays.has(today);
  const lines = [
    usualDayLine({ byDate: dailyTotals(mine, currency), firstDate, today, confirmedToday }),
    noSpendLine(noSpendDays, today),
    monthPaceLine({ entries: mine, firstDate, today, currency }),
    budgetLine({ entries: mine, today, currency, categories, isSoleMember }),
  ].filter((l): l is ShareLine => l !== null);
  if (lines.length) return lines.slice(0, MAX_SHARE_LINES);
  const loggedToday = mine.some((e) => e.date === today);
  return loggedToday || confirmedToday ? [{ kind: "kept_up", text: "Kept my log up today" }] : [];
};

/** The card's buddy: always pleased (it's a brag), picked for the day. */
export const shareFace = (seed: number): string =>
  pick(seed % 2 ? FACES.delighted.resting : FACES.happy.resting, Math.floor(seed / 2));

export type BreakdownSlice = { id: string; name: string; share: number };

/** Most slices a breakdown shows before the rest become "other". */
export const MAX_BREAKDOWN_SLICES = 5;

/** A breakdown covers one day ("YYYY-MM-DD") or one month ("YYYY-MM"). */
export type BreakdownPeriod = { day: string } | { month: string };

/**
 * My spending in one day or month by category, as shares only (biggest first), with
 * anything past MAX_BREAKDOWN_SLICES folded into "other". A day leaves out fixed costs
 * (rent on the 1st would swallow the pie); a month keeps them.
 */
export const breakdownSlices = ({
  entries,
  myUid,
  period,
  currency,
  categories,
}: {
  entries: ReadonlyArray<LedgerEntry>;
  myUid: string;
  period: BreakdownPeriod;
  currency: Currency;
  categories: ReadonlyArray<LedgerCategory>;
}): BreakdownSlice[] => {
  const mine = entries.filter(
    (e) =>
      e.authorUid === myUid &&
      ("day" in period
        ? e.date === period.day && !isFixedCategory(resolveCategory(e.categoryId, categories))
        : e.month === period.month),
  );
  const shares = categoryShares(aggregateEntries(mine), currency, categories);
  const shown = shares.length > MAX_BREAKDOWN_SLICES + 1 ? MAX_BREAKDOWN_SLICES : shares.length;
  const slices = shares.slice(0, shown).map(({ id, name, share }) => ({ id, name, share }));
  const rest = shares.slice(shown).reduce((sum, s) => sum + s.share, 0);
  return rest > 0 ? [...slices, { id: "other", name: "other", share: rest }] : slices;
};

/**
 * One of the knick-knacks the person has kept (seen), each item equally likely however
 * many copies they hold; null with none. Counts never reach the card.
 */
export const pickShareKnickKnack = (
  finds: ReadonlyArray<Pick<KnickKnackFind, "item" | "seenAt">>,
  rand: () => number = Math.random,
): KnickKnackId | null => {
  const kept = new Set(finds.filter((f) => f.seenAt).map((f) => f.item));
  const items = KNICK_KNACK_IDS.filter((id) => kept.has(id));
  return items.length ? items[Math.min(items.length - 1, Math.floor(rand() * items.length))] : null;
};
