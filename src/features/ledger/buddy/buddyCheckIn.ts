import dayjs from "@/utils/configuredDayjs";
import { Currency } from "@/types/user";
import { CurrencyAmounts, LedgerMonth } from "@/types/ledger";
import { monthKeyOf } from "@/utils/ledger";
import { storage } from "@/platform";

/** The buddy checks in on its own from 17:00 in the viewer's timezone. */
export const CHECK_IN_FROM_HOUR = 17;
/** "Recent" spending: the days before today that today is measured against. */
export const CHECK_IN_WINDOW_DAYS = 14;
/** Days with spending needed in that window before a day can count as light. */
export const CHECK_IN_MIN_LOGGED_DAYS = 5;
/** Today counts as light at or below this share of a typical spending day. */
export const LIGHT_DAY_RATIO = 1 / 3;

/**
 * - quiet: nothing logged today yet.
 * - light: today is well under a typical spending day.
 */
export type CheckIn = "quiet" | "light";

type MonthDocs = {
  current?: Pick<LedgerMonth, "month" | "byDay"> | null;
  previous?: Pick<LedgerMonth, "month" | "byDay"> | null;
};

/** One day's spending, from whichever of the two month docs holds it. */
export const dayAmounts = (date: string, { current, previous }: MonthDocs): CurrencyAmounts => {
  const month = monthKeyOf(date);
  const doc = current?.month === month ? current : previous?.month === month ? previous : null;
  return doc?.byDay?.[date.slice(8, 10)] ?? {};
};

const spentIn = (amounts: CurrencyAmounts): Currency[] =>
  (Object.keys(amounts) as Currency[]).filter((c) => (amounts[c] ?? 0) > 0);

/**
 * Whether the buddy has something encouraging to say this evening, unprompted. The
 * window is the 14 days before today, so the current and previous month docs cover it.
 * Spending is the whole log's, matching the buddy's "we".
 */
export const eveningCheckIn = ({
  today,
  localHour,
  current,
  previous,
}: MonthDocs & {
  /** "YYYY-MM-DD" in the viewer's timezone. */
  today: string;
  localHour: number;
}): CheckIn | null => {
  if (localHour < CHECK_IN_FROM_HOUR) return null;

  const docs = { current, previous };
  const todays = dayAmounts(today, docs);
  const spentToday = spentIn(todays);
  if (!spentToday.length) return "quiet";

  const sums: CurrencyAmounts = {};
  const spendDays: Partial<Record<Currency, number>> = {};
  let loggedDays = 0;
  for (let back = 1; back <= CHECK_IN_WINDOW_DAYS; back++) {
    const amounts = dayAmounts(dayjs(today).subtract(back, "day").format("YYYY-MM-DD"), docs);
    const spent = spentIn(amounts);
    if (spent.length) loggedDays++;
    for (const c of spent) {
      sums[c] = (sums[c] ?? 0) + amounts[c]!;
      spendDays[c] = (spendDays[c] ?? 0) + 1;
    }
  }
  if (loggedDays < CHECK_IN_MIN_LOGGED_DAYS) return null;

  // Every currency spent today has to be light against its own typical spending day.
  const light = spentToday.every((c) => {
    const days = spendDays[c] ?? 0;
    if (!days) return false;
    return todays[c]! <= (sums[c]! / days) * LIGHT_DAY_RATIO;
  });
  return light ? "light" : null;
};

const checkInKey = (ledgerId: string) => `ML__buddy_checkin_${ledgerId}`;

// Losing the record only means the buddy might check in twice in a day.
/** Whether the buddy already checked in on this log today. */
export const checkedInToday = (ledgerId: string, today: string): boolean =>
  storage.get(checkInKey(ledgerId)) === today;

export const markCheckedIn = (ledgerId: string, today: string) => {
  storage.set(checkInKey(ledgerId), today);
};
