import { Currency } from "@/types/user";
import { formatAmount } from "@/utils/ledgerEntries";
import { BuddyFacts, BuddyState } from "./buddyMood";
import { BuddyMood } from "./faces";

/** A line, or nothing when the facts it needs aren't there. */
type Line = (f: BuddyFacts) => string | null;

const money = (f: BuddyFacts, value?: number | null) =>
  f.currency !== undefined && typeof value === "number"
    ? formatAmount(Math.round(value), f.currency as Currency)
    : null;

const pct = (n?: number | null) => (typeof n === "number" ? `${Math.round(n * 100)}%` : null);

const days = (n: number) => `${n} day${n === 1 ? "" : "s"}`;

const budgetUsed: Line = (f) =>
  f.hasBudget && pct(f.used)
    ? `${pct(f.used)} of the ${f.currency} budget gone, ${days(f.daysLeft)} to go.`
    : null;

const pace: Line = (f) =>
  f.hasBudget && money(f, f.projected) && money(f, f.budget)
    ? `at this pace: about ${money(f, f.projected)} by month end, against ${money(f, f.budget)}.`
    : null;

const vsLast: Line = (f) => {
  if (typeof f.change !== "number") return null;
  const change = Math.round(Math.abs(f.change) * 100);
  if (change < 5) return "about the same as this point last month. steady paws.";
  return f.change > 0
    ? `spending's up ${change}% on this point last month.`
    : `spending's down ${change}% on this point last month ♡`;
};

const streak: Line = (f) =>
  f.noSpendDays >= 2 ? `${days(f.noSpendDays)} without spending. very zen.` : null;

const top: Line = (f) => (f.topCategory ? `most of it's going on ${f.topCategory}.` : null);

const noBudget: Line = (f) =>
  f.hasBudget ? null : "no budget yet… want to set one in categories?";

const LINES: Record<BuddyMood, Line[]> = {
  delighted: [
    (f) => `${budgetUsed(f) ?? vsLast(f) ?? "look at you go."} purr purr ♡`,
    streak,
    () => "this month is going beautifully. i might nap on the receipts.",
    pace,
  ],
  happy: [
    (f) => `${budgetUsed(f) ?? vsLast(f) ?? "things look good."} purr.`,
    streak,
    () => "comfortably on track. carry on.",
    top,
  ],
  content: [
    (f) => budgetUsed(f) ?? vsLast(f) ?? "all quiet on the money front.",
    top,
    () => "right about where we should be. mrrp.",
    noBudget,
  ],
  wary: [
    (f) => pace(f) ?? vsLast(f),
    (f) => (budgetUsed(f) ? `${budgetUsed(f)} hmm.` : null),
    top,
    () => "a little quick this month. i'm keeping an eye on it.",
    noBudget,
  ],
  worried: [
    (f) => (pace(f) ? `${pace(f)} hiss.` : vsLast(f)),
    (f) => (budgetUsed(f) ? `${budgetUsed(f)} ...that's a lot.` : null),
    top,
    () => "maybe a quiet week or two? for me?",
  ],
  alarmed: [
    (f) =>
      money(f, f.spent) && money(f, f.budget)
        ? `${money(f, f.spent)} spent against a ${money(f, f.budget)} budget. shaaa!`
        : "we're over budget!!",
    (f) =>
      f.daysLeft > 1 ? `over budget with ${days(f.daysLeft)} still to go. fur on end.` : null,
    top,
    () => "the budget has been knocked off the table.",
  ],
  idle: [
    () => "nothing logged this month yet. i'm watching. ｼﾞｰ",
    noBudget,
    () => "a fresh month. no crumbs to chase yet.",
  ],
};

const SLEEPY = ["zzz… mrrp? oh.", "five more minutes…", "*yawn* …you again."];

/**
 * What the buddy says when clicked. Stable for the day (seed), and moves to the next line
 * on each click (nth). Lines whose facts are missing are skipped.
 */
export const buddyComment = ({ mood, asleep, facts, seed }: BuddyState, nth = 0): string => {
  const lines = LINES[mood].map((line) => line(facts)).filter((line): line is string => !!line);
  const said = lines.length ? lines[(seed + nth) % lines.length] : "mrrp.";
  return asleep ? `${SLEEPY[(seed + nth) % SLEEPY.length]} ${said}` : said;
};
