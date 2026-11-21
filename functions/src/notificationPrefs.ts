/**
 * Per-user notification switches, read from `users.notificationPrefs.{key}`. An unset
 * key falls back to its default here. Mirrors src/utils/notificationTypes.ts
 * (NOTIFICATION_PREF_DEFAULTS); a root test keeps the two in step. Every writer checks
 * this before writing, so a settings UI can switch types off without touching the
 * writers.
 */

export const NOTIFICATION_PREF_DEFAULTS = {
  comment: true,
  reaction: true,
  log_created: true,
  log_joined: true,
  log_invite: true,
  log_ending: true,
  log_ended: true,
  sublog_counted: true,
  budget_approaching: true,
  budget_exceeded: true,
  budget_projected: true,
  friend_request: true,
  friend_accepted: true,
  gift_received: true,
  milestone_earned: true,
  achievement_earned: true,
  // Per-category budget alerts are noisier than the month's total, so they're opt-in.
  budget_category: false,
} as const;

export type NotificationPrefKey = keyof typeof NOTIFICATION_PREF_DEFAULTS;

export const isNotificationEnabled = (
  userData: { notificationPrefs?: unknown } | undefined,
  key: NotificationPrefKey,
): boolean => {
  const prefs = userData?.notificationPrefs;
  const value =
    prefs && typeof prefs === "object" ? (prefs as Record<string, unknown>)[key] : undefined;
  return typeof value === "boolean" ? value : NOTIFICATION_PREF_DEFAULTS[key];
};

/**
 * Which types go into the daily email digest when the user hasn't chosen
 * (`users.emailPrefs.{type}`). Mirrors EMAIL_PREF_DEFAULTS in
 * src/utils/notificationTypes.ts. Starting or joining a log is the user's own action,
 * so those are never emailed (NEVER_EMAILED).
 */
export const EMAIL_PREF_DEFAULTS = {
  comment: false,
  reaction: false,
  log_created: false,
  log_joined: false,
  log_invite: true,
  log_ending: true,
  log_ended: true,
  // Your spending showing in another log: worth hearing about even away from the app.
  sublog_counted: true,
  budget_approaching: false,
  budget_exceeded: true,
  budget_projected: false,
  friend_request: true,
  friend_accepted: false,
  gift_received: false,
  milestone_earned: false,
  achievement_earned: false,
} as const;

export type EmailPrefKey = keyof typeof EMAIL_PREF_DEFAULTS;

export const NEVER_EMAILED: ReadonlySet<string> = new Set(["log_created", "log_joined"]);

export const isEmailPrefKey = (type: unknown): type is EmailPrefKey =>
  typeof type === "string" && Object.prototype.hasOwnProperty.call(EMAIL_PREF_DEFAULTS, type);

/**
 * Whether a notification of this type goes into the user's email digest. Unknown types,
 * paused email, never-emailed types and types switched off in-app all say no.
 */
export const isEmailEnabled = (
  userData:
    | { notificationPrefs?: unknown; emailPrefs?: unknown; emailPaused?: unknown }
    | undefined,
  type: unknown,
): boolean => {
  if (!isEmailPrefKey(type) || NEVER_EMAILED.has(type)) return false;
  if (userData?.emailPaused === true) return false;
  if (!isNotificationEnabled(userData, type)) return false;
  const prefs = userData?.emailPrefs;
  const value =
    prefs && typeof prefs === "object" ? (prefs as Record<string, unknown>)[type] : undefined;
  return typeof value === "boolean" ? value : EMAIL_PREF_DEFAULTS[type];
};
