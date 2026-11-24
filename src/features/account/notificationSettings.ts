import type { UserFieldsPatch } from "@/hooks/useUserQuery";
import type { NotificationPrefKey, NotificationType } from "@/types/notification";
import {
  EMAIL_PREF_DEFAULTS,
  EmailPrefsSource,
  isEmailable,
  isNotificationEnabled,
  NOTIFICATION_TYPES,
} from "@/utils/notificationTypes";

/** Where one kind of notification goes: the inbox and the daily email, the inbox only, or nowhere. */
export type Channel = "email" | "inbox" | "off";

export const CHANNEL_LABELS: Record<Channel, string> = {
  email: "inbox + email",
  inbox: "inbox only",
  off: "off",
};

/** budget_category isn't a type of its own: it lets per-category budget alerts through. */
export const BUDGET_CATEGORY_LABEL = "Per-category budget alerts";

/** The drawer's sections, in reading order. Every pref key appears exactly once. */
export const NOTIFICATION_SETTING_GROUPS: ReadonlyArray<{
  title: string;
  keys: ReadonlyArray<NotificationPrefKey>;
}> = [
  { title: "posts", keys: ["comment", "reaction"] },
  {
    title: "logs",
    keys: ["log_invite", "log_ending", "log_ended", "sublog_counted", "log_created", "log_joined"],
  },
  {
    title: "budgets",
    keys: [
      "budget_approaching",
      "budget_exceeded",
      "budget_projected",
      "budget_category",
      "scheduled_logged",
    ],
  },
  {
    title: "friends & finds",
    keys: [
      "friend_request",
      "friend_accepted",
      "gift_received",
      "milestone_earned",
      "achievement_earned",
    ],
  },
];

const isType = (key: NotificationPrefKey): key is NotificationType => key !== "budget_category";

/** The choices a row offers: email only for types that can be emailed. */
export const channelsFor = (key: NotificationPrefKey): Channel[] =>
  isType(key) && isEmailable(key) ? ["email", "inbox", "off"] : ["inbox", "off"];

export const settingLabel = (key: NotificationPrefKey): string =>
  isType(key) ? NOTIFICATION_TYPES[key].label : BUDGET_CATEGORY_LABEL;

/** The row's current choice. Ignores emailPaused, which has its own switch. */
export const channelOf = (
  user: EmailPrefsSource | undefined,
  key: NotificationPrefKey,
): Channel => {
  if (!isNotificationEnabled(user?.notificationPrefs, key)) return "off";
  if (!isType(key) || !isEmailable(key)) return "inbox";
  return (user?.emailPrefs?.[key] ?? EMAIL_PREF_DEFAULTS[key]) ? "email" : "inbox";
};

/**
 * The dotted user-doc update for a choice. Turning a type off leaves its email pref
 * alone, so switching it back on restores what the user had.
 */
export const channelPatch = (key: NotificationPrefKey, channel: Channel): UserFieldsPatch => {
  if (channel === "off") return { [`notificationPrefs.${key}`]: false };
  const patch: UserFieldsPatch = { [`notificationPrefs.${key}`]: true };
  if (isType(key) && isEmailable(key)) {
    return { ...patch, [`emailPrefs.${key}`]: channel === "email" };
  }
  return patch;
};

/** How many types the digest would include, ignoring the pause switch. */
export const emailedTypeCount = (user: EmailPrefsSource | undefined): number =>
  (Object.keys(NOTIFICATION_TYPES) as NotificationType[]).filter(
    (type) => channelOf(user, type) === "email",
  ).length;

/** One-line summary for the drawer, e.g. "daily email · 4 types". */
export const notificationsSummary = (user: EmailPrefsSource | undefined): string => {
  if (user?.emailPaused) return "email paused";
  const count = emailedTypeCount(user);
  if (!count) return "inbox only";
  return `daily email · ${count} ${count === 1 ? "type" : "types"}`;
};
