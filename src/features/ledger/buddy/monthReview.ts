import dayjs from "@/utils/configuredDayjs";
import { monthKeyOf, shiftMonth } from "@/utils/ledger";
import { storage } from "@/platform";

/**
 * The month-start review. On the 1st to the 3rd of a month (the person's timezone), the
 * buddy offers to look back at last month and decide whether to change the budgets for
 * the new one. Waiting for the 1st means last month is over, so editing the standing
 * budgets only touches the new month (and budgetHistory keeps last month's).
 *
 * The answer is per log and synced across devices:
 * users/{userDocId}/monthReviews/{ledgerId}_{YYYY-MM}, keyed by the month reviewed.
 */
export const REVIEW_WINDOW_DAYS = 3;

export type MonthReviewStatus = "snoozed" | "dismissed" | "reviewing" | "done";
export type MonthReviewState = {
  status: MonthReviewStatus;
  /** "YYYY-MM-DD": when a snoozed review may ask again. */
  snoozedUntil?: string;
};

const dayOfMonth = (today: string) => Number(today.slice(8, 10));

/** The month up for review today ("YYYY-MM"), or null outside the window. */
export const reviewedMonth = (today: string): string | null =>
  dayOfMonth(today) <= REVIEW_WINDOW_DAYS ? shiftMonth(monthKeyOf(today), -1) : null;

/** "Ask me tomorrow" only while tomorrow is still in the window. */
export const canSnooze = (today: string): boolean => dayOfMonth(today) < REVIEW_WINDOW_DAYS;

export const tomorrowOf = (today: string): string =>
  dayjs(today).add(1, "day").format("YYYY-MM-DD");

/** Whether the buddy should ask today, given what was answered so far (null: nothing). */
export const shouldPrompt = (state: MonthReviewState | null, today: string): boolean => {
  if (!reviewedMonth(today)) return false;
  if (!state) return true;
  if (state.status === "snoozed") return !state.snoozedUntil || today >= state.snoozedUntil;
  return false;
};

export const reviewDocId = (ledgerId: string, month: string) => `${ledgerId}_${month}`;

/** "october", for the buddy's lowercase voice. */
export const monthName = (month: string): string =>
  dayjs(`${month}-01`).format("MMMM").toLowerCase();

// Only stops the bubble opening by itself more than once a day per log on this device;
// a click on the buddy still brings the question back while it's due.
const shownKey = (ledgerId: string) => `ML__buddy_review_${ledgerId}`;

export const reviewShownToday = (ledgerId: string, today: string): boolean =>
  storage.get(shownKey(ledgerId)) === today;

export const markReviewShown = (ledgerId: string, today: string) => {
  storage.set(shownKey(ledgerId), today);
};
