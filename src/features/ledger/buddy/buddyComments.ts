import { BuddyFacts, BuddyState } from "./buddyMood";
import { BuddyMood } from "./faces";

/**
 * What the buddy says when clicked. Chatty and a bit vague on purpose: it rounds the
 * month into words ("about half the budget", "a couple of weeks left") rather than
 * quoting numbers.
 */

/** A line, or nothing when the facts it needs aren't there. */
type Line = (f: BuddyFacts) => string | null;

/** How much of the budget is gone, in words. */
export const shareInWords = (used: number): string => {
  if (used < 0.1) return "barely a nibble of";
  if (used < 0.2) return "a little bit of";
  if (used < 0.3) return "about a quarter of";
  if (used < 0.42) return "about a third of";
  if (used < 0.58) return "about half of";
  if (used < 0.72) return "a good chunk of";
  if (used < 0.9) return "most of";
  if (used <= 1) return "nearly all of";
  return "more than all of";
};

/** How much of the month is left, as a clause. */
export const daysLeftInWords = (days: number): string => {
  if (days <= 1) return "it's the last day of the month";
  if (days <= 4) return "there are just a few days left";
  if (days <= 9) return "there's about a week left";
  if (days <= 17) return "there are a couple of weeks left";
  return "there's lots of month left";
};

const used: Line = (f) =>
  f.hasBudget && typeof f.used === "number"
    ? `we've used ${shareInWords(f.used)} the budget, and ${daysLeftInWords(f.daysLeft)}.`
    : null;

const vsLastMonth: Line = (f) => {
  if (typeof f.change !== "number") return null;
  if (Math.abs(f.change) < 0.1) return "we're spending about the same as this time last month~";
  if (f.change > 0.3) return "we're spending quite a bit more than this time last month…";
  if (f.change > 0) return "a teeny bit more than this time last month, hmm.";
  if (f.change < -0.3) return "way less than this time last month!! so proud of us ♡";
  return "a little less than this time last month. nice!";
};

const overPace: Line = (f) =>
  f.hasBudget &&
  typeof f.projected === "number" &&
  typeof f.budget === "number" &&
  f.projected > f.budget
    ? "if we keep going like this, we'll run past the budget before the month's out…"
    : null;

const streak: Line = (f) =>
  f.noSpendDays >= 2 ? `${f.noSpendDays} whole days without spending! so zen ♡` : null;

const favourite: Line = (f) =>
  f.topCategory ? `${f.topCategory} seems to be our favourite thing this month, huh?` : null;

const noBudget: Line = (f) =>
  f.hasBudget ? null : "psst… we could set a budget in categories. i'd keep an eye on it for you!";

const LINES: Record<BuddyMood, Line[]> = {
  delighted: [
    (f) => (used(f) ? `${used(f)} we're doing amazing!!` : "we're doing amazing this month!!"),
    streak,
    vsLastMonth,
    () => "you're the best human. i might nap on the receipts out of sheer joy~",
  ],
  happy: [
    (f) => (used(f) ? `${used(f)} right on track ♪` : "things are looking good this month ♪"),
    streak,
    vsLastMonth,
    () => "nice and steady. i approve! *purrs*",
  ],
  content: [
    used,
    vsLastMonth,
    () => "everything's about where it should be. mrrp~",
    favourite,
    noBudget,
  ],
  wary: [
    (f) => (used(f) ? `hmm… ${used(f)}` : "hmm… things are moving a little quick."),
    overPace,
    favourite,
    () => "we're going a tiny bit fast. i'm watching… very closely.",
    noBudget,
  ],
  worried: [
    overPace,
    (f) => (used(f) ? `${used(f)} that's a lot…` : vsLastMonth(f)),
    favourite,
    () => "maybe a quiet week or two? for me? (´・ω・`)",
  ],
  alarmed: [
    () => "we've gone over the budget!! my fur is standing on end!",
    (f) =>
      f.daysLeft > 1
        ? `over budget, and ${daysLeftInWords(f.daysLeft)}… we need a plan!`
        : "over budget… but the month's nearly over. fresh start soon?",
    favourite,
    () => "the budget got knocked right off the table. *hiss*",
  ],
  idle: [
    () => "nothing logged this month yet. i'm just waiting here… patiently. ｼﾞｰ",
    noBudget,
    () => "a brand new month! no crumbs to chase yet~",
  ],
};

const SLEEPY = ["zzz… mrrp? oh, it's you.", "five more minutes…", "*yawn* …you're up late."];

/**
 * Stable for the day (seed), and moves to the next line on each click (nth). Lines
 * whose facts are missing are skipped.
 */
export const buddyComment = ({ mood, asleep, facts, seed }: BuddyState, nth = 0): string => {
  const lines = LINES[mood].map((line) => line(facts)).filter((line): line is string => !!line);
  const said = lines.length ? lines[(seed + nth) % lines.length] : "mrrp?";
  return asleep ? `${SLEEPY[(seed + nth) % SLEEPY.length]} ${said}` : said;
};
