import dayjs from "@/utils/configuredDayjs";
import type { IconType } from "@/components/Icon";
import { Currency } from "@/types/user";
import { formatAmount } from "@/utils/ledgerEntries";
import {
  AppNotification,
  BudgetNotification,
  NotificationPrefKey,
  NotificationOf,
  NotificationPrefs,
  NotificationType,
} from "@/types/notification";

/**
 * A line of notification copy. Plain strings follow the app's lowercase type rules.
 * `{ keep }` parts are user content (names, log titles, excerpts), which keep their own
 * case.
 */
export type CopyPart = string | { keep: string };

type TypeSpec<N extends AppNotification> = {
  /** For a future preferences drawer. */
  label: string;
  /** Whether a user who has never set this preference receives it. */
  defaultEnabled: boolean;
  icon: IconType;
  describe: (n: N, now: Date) => CopyPart[];
  /** A quote or other secondary line under the main copy. */
  detail?: (n: N) => string | undefined;
  href: (n: N) => string;
};

type Specs = { [T in NotificationType]: TypeSpec<NotificationOf<T>> };

const logHref = (n: AppNotification) =>
  n.logKind === "ledger" ? `/l/${n.groupId}` : `/g/${n.groupId}`;

const amount = (value: number, currency: string) => formatAmount(value, currency as Currency);

const budgetSubject = (n: BudgetNotification): CopyPart[] =>
  n.categoryName
    ? ["the ", { keep: n.categoryName }, ` ${n.currency} budget`]
    : [`your ${n.currency} budget`];

const percent = (spent: number, budget: number) =>
  budget > 0 ? Math.floor((spent / budget) * 100) : 100;

export const NOTIFICATION_TYPES: Specs = {
  comment: {
    label: "Comments on posts you wrote or follow",
    defaultEnabled: true,
    icon: "speech",
    describe: (n) => [
      { keep: n.actorName },
      n.reason === "author"
        ? " commented on your post in "
        : n.reason === "subscriber"
          ? " commented on a post you follow in "
          : " commented in ",
      { keep: n.groupName },
    ],
    detail: (n) => n.excerpt,
    href: (n) => `/g/${n.groupId}`,
  },
  reaction: {
    label: "Reactions to your posts",
    defaultEnabled: true,
    icon: "smiley",
    describe: (n) => [
      { keep: n.actorName },
      ` reacted ${n.emoji} to `,
      n.reason === "subscriber" ? "a post you follow" : "your post",
      " in ",
      { keep: n.groupName },
    ],
    href: (n) => `/g/${n.groupId}`,
  },
  log_created: {
    label: "Logs you start",
    defaultEnabled: true,
    icon: "plus",
    describe: (n) => ["you started ", { keep: n.groupName }],
    href: logHref,
  },
  log_joined: {
    label: "Logs you join",
    defaultEnabled: true,
    icon: "social",
    describe: (n) => ["you joined ", { keep: n.groupName }],
    href: logHref,
  },
  log_ending: {
    label: "A log is about to end",
    defaultEnabled: true,
    icon: "clock",
    describe: (n, now) => [
      { keep: n.groupName },
      ` ends ${dayjs(n.endsAt.toDate()).from(now)}: last chance to post`,
    ],
    href: logHref,
  },
  log_ended: {
    label: "A log has ended",
    defaultEnabled: true,
    icon: "document",
    describe: (n, now) => {
      const summary = n.summaryAt ? dayjs(n.summaryAt.toDate()) : null;
      return [
        { keep: n.groupName },
        " has ended",
        summary
          ? summary.isAfter(now)
            ? `: summary ready ${summary.from(now)}`
            : ": the summary is ready"
          : "",
      ];
    },
    href: logHref,
  },
  budget_approaching: {
    label: "You're approaching a budget",
    defaultEnabled: true,
    icon: "dollar",
    describe: (n) => [
      `${percent(n.spent, n.budget)}% of `,
      ...budgetSubject(n),
      " used in ",
      { keep: n.groupName },
    ],
    detail: (n) => `${amount(n.spent, n.currency)} of ${amount(n.budget, n.currency)}`,
    href: (n) => `/l/${n.groupId}/stats?month=${n.month}`,
  },
  budget_exceeded: {
    label: "You've gone over a budget",
    defaultEnabled: true,
    icon: "warning",
    describe: (n) => ["over ", ...budgetSubject(n), " in ", { keep: n.groupName }],
    detail: (n) => `${amount(n.spent, n.currency)} of ${amount(n.budget, n.currency)}`,
    href: (n) => `/l/${n.groupId}/stats?month=${n.month}`,
  },
  budget_projected: {
    label: "You're on track to go over this month's budget",
    defaultEnabled: true,
    icon: "dollar",
    describe: (n) => [
      "on track to go over ",
      ...budgetSubject(n),
      " in ",
      { keep: n.groupName },
      " this month",
    ],
    detail: (n) =>
      n.projected === undefined
        ? undefined
        : `about ${amount(n.projected, n.currency)} by month end, against ${amount(n.budget, n.currency)}`,
    href: (n) => `/l/${n.groupId}/stats?month=${n.month}`,
  },
};

const specOf = <N extends AppNotification>(n: N) =>
  NOTIFICATION_TYPES[n.type] as unknown as TypeSpec<N> | undefined;

/** Copy for a notification. Unknown types (from a newer build) get a generic line. */
export const describeNotification = (n: AppNotification, now: Date = new Date()): CopyPart[] =>
  specOf(n)?.describe(n, now) ?? ["something happened in ", { keep: n.groupName ?? "a log" }];

export const notificationDetail = (n: AppNotification): string | undefined =>
  specOf(n)?.detail?.(n);

export const notificationHref = (n: AppNotification): string => specOf(n)?.href(n) ?? logHref(n);

export const notificationIcon = (n: AppNotification): IconType => specOf(n)?.icon ?? "notification";

/** Plain text, for aria labels and tests. */
export const notificationText = (n: AppNotification, now: Date = new Date()): string =>
  describeNotification(n, now)
    .map((part) => (typeof part === "string" ? part : part.keep))
    .join("");

/**
 * Per-category budget alerts are the only ones off by default. They're noisier than
 * the month's total.
 */
export const NOTIFICATION_PREF_DEFAULTS: Record<NotificationPrefKey, boolean> = {
  ...(Object.fromEntries(
    Object.entries(NOTIFICATION_TYPES).map(([type, spec]) => [type, spec.defaultEnabled]),
  ) as Record<NotificationType, boolean>),
  budget_category: false,
};

/** Whether `users.notificationPrefs` lets this kind of notification through. */
export const isNotificationEnabled = (
  prefs: NotificationPrefs | undefined,
  key: NotificationPrefKey,
): boolean => prefs?.[key] ?? NOTIFICATION_PREF_DEFAULTS[key];

/** The latest snapshot holds at most this many, so the badge caps out below it. */
export const LATEST_NOTIFICATIONS_LIMIT = 20;
const BADGE_CAP = 9;

export const countUnread = (items: ReadonlyArray<Pick<AppNotification, "readAt">>): number =>
  items.filter((n) => !n.readAt).length;

/** The bell's badge text: nothing when all read, then 1–9, then "9+". */
export const unreadBadge = (count: number): string | null =>
  count <= 0 ? null : count > BADGE_CAP ? `${BADGE_CAP}+` : String(count);
