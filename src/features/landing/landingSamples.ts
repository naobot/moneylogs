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

export const SAMPLE_NOW: SampleCard[] = [
  {
    title: "Lisbon long weekend",
    kind: "log group",
    details: ["ends in 2 days", memberLabel(4)],
    badge: formatNewCount(5, "social"),
  },
  {
    title: "Flat 2B",
    kind: "financial · shared",
    details: ["November: 1,284.50 CAD", memberLabel(3)],
    badge: formatNewCount(2, "financial"),
  },
  {
    title: "No-spend November",
    kind: "log group",
    details: ["ends in 20 days", memberLabel(6)],
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

/** One day of the "Lisbon long weekend" log, for the peek inside a log. */
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

export const HOW_IT_WORKS = [
  {
    title: "Start a log",
    text: "One for a trip, a weekend, a no-spend month — or an ongoing financial log for a shared flat.",
  },
  {
    title: "Invite your people",
    text: "Share a link. Friends who aren't ready to post can still follow along as spectators.",
  },
  {
    title: "Post as you go",
    text: "What you spent, in any currency, and why. Others react and comment.",
  },
  {
    title: "See how it added up",
    text: "Once a log ends, everyone gets the totals, the hot posts and how the group spent.",
  },
];
