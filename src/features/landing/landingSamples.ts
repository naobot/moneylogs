/**
 * Made-up logs for the logged-out landing page. They're rendered with the real dashboard
 * cards, so a visitor sees what Home looks like once they've joined a few logs. Nothing
 * here is read from Firestore.
 */
import { memberLabel } from "@/utils/dashboard";
import { formatNewCount } from "@/utils/logActivity";

export type SampleCard = {
  title: string;
  kind?: string;
  details: string[];
  badge?: string;
};

export type SamplePost = {
  time: string;
  amount: string;
  author: string;
  text: string;
  reactions: { emoji: string; count: number }[];
  comments: number;
};

// Personal tracking leads; shared and trip logs follow.
export const SAMPLE_NOW: SampleCard[] = [
  {
    title: "My spending",
    kind: "financial",
    details: ["November: 642.18 CAD", memberLabel(1)],
  },
  {
    title: "Flat 2B",
    kind: "financial · shared",
    details: ["November: 1,284.50 CAD", memberLabel(3)],
    badge: formatNewCount(2, "financial"),
  },
  {
    title: "Lisbon long weekend",
    kind: "log group",
    details: ["ends in 2 days", memberLabel(4)],
    badge: formatNewCount(5, "social"),
  },
];

export const SAMPLE_UPCOMING: SampleCard[] = [
  { title: "Ski cabin", details: ["starts in 12 days"] },
  { title: "Festival weekend", details: ["starts in a month"] },
];

export const SAMPLE_RECENT: SampleCard[] = [
  { title: "Osaka eats", details: ["ended Oct 14"] },
  { title: "Camping trip", details: ["ended Sep 2"] },
  { title: "Spring cleanout", details: ["ended Apr 30"] },
];

/** One day of the "Lisbon long weekend" group log, for the peek inside a log. */
export const SAMPLE_TRIP_TITLE = "Lisbon long weekend";

export const SAMPLE_DAY = {
  label: "Sat, Nov 8",
  total: "86.40 EUR",
};

export const SAMPLE_POSTS: SamplePost[] = [
  {
    time: "9:12 AM",
    amount: "6.40 EUR",
    author: "Maya",
    text: "Two pastéis de nata and a bica. Breakfast of champions.",
    reactions: [{ emoji: "🥐", count: 3 }],
    comments: 2,
  },
  {
    time: "1:47 PM",
    amount: "80 EUR",
    author: "Theo",
    text: "Tram 28 was packed so we split a tuk-tuk up to the castle. Worth it for the view.",
    reactions: [
      { emoji: "🔥", count: 2 },
      { emoji: "😂", count: 1 },
    ],
    comments: 4,
  },
];

/** The main pitch: an everyday spending tracker. */
export const TRACKING = [
  {
    title: "An ongoing tracker",
    text: "Log each purchase as it happens, in any currency. Your log has no end date.",
  },
  {
    title: "Categories and budgets",
    text: "Sort entries into your own categories and set monthly budgets to keep an eye on.",
  },
  {
    title: "Stats that are always on",
    text: "See where this month's money went, category by category, whenever you like.",
  },
  {
    title: "Private until you share it",
    text: "It's yours alone unless you invite someone in.",
  },
];

/** The gentle social side: optional, small-circle, no audience. */
export const WITH_FRIENDS = [
  {
    title: "Friends, not followers",
    text: "Add people you actually know with a personal invite link. There's no public feed.",
  },
  {
    title: "Share a log",
    text: "Invite a partner or flatmates into a financial log and track the household together.",
  },
  {
    title: "Every entry is a post",
    text: "Each purchase is a little microblog post. Write a line or a paragraph about why you bought it, and add a photo if you like. Friends can react or leave a comment.",
  },
  {
    title: "Group logs",
    text: "Start one for a trip. Particularly open friend groups can keep one going for a fond, slightly voyeuristic look at each other's lives. Extra fun if you live in different cities.",
  },
];

export const HOW_IT_WORKS = [
  {
    title: "Start your log",
    text: "An ongoing financial log, just for you. Bring your history from another app if you have one.",
  },
  {
    title: "Post as you go",
    text: "What you spent, in any currency, and why.",
  },
  {
    title: "Bring people in, if you like",
    text: "Share a log with your household, or start a group log for a trip or a no-spend month.",
  },
  {
    title: "See how it adds up",
    text: "Monthly stats and budgets for your own spending, and totals and hot posts when a group log ends.",
  },
];
