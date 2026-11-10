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
  log_ending: true,
  log_ended: true,
  budget_approaching: true,
  budget_exceeded: true,
  budget_projected: true,
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
