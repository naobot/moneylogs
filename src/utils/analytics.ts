import { logEvent } from "firebase/analytics";
import { matchPath } from "react-router-dom";
import { analytics } from "@/config/firebase-config";
import type { LogKind } from "@/types/notification";

/**
 * Aggregate usage analytics (Google Analytics 4 via Firebase).
 *
 * Every event the app sends is listed in `AnalyticsEvents`, so each action is its own
 * row in GA's Events report. Params are deliberately low-cardinality (a kind, a source,
 * a count): never user, log, post or comment ids, names, amounts or free text. We want
 * "how much is X used", not "what did this person do".
 *
 * Params other than GA's own (`method`, `content_type`) only show in standard reports
 * once registered as event-scoped custom dimensions; see docs/analytics.md.
 */
export type AnalyticsEvents = {
  // Accounts (GA recommended event names)
  sign_up: { method: "email" };
  login: { method: "email" };
  tutorial_complete: { tutorial: "welcome" | "ledger_tour" | "first_post" };

  // Logs
  create_log: { log_kind: LogKindParam; invited_friends: number };
  join_log: { log_kind: LogKindParam };
  archive_log: { log_kind: LogKindParam; archived: boolean };
  delete_log: { log_kind: LogKindParam };
  invite_friends_to_log: { log_kind: LogKindParam; invited_friends: number };

  // Social logs
  add_post: { travelling: boolean };
  open_comments: { has_comments: boolean };
  add_comment: Record<string, never>;
  add_reaction: Record<string, never>;

  // Financial logs (ledgers)
  add_entry: { shared_log: boolean; has_note: boolean };
  import_entries: { source: string; created: number };
  no_spend_day: Record<string, never>;

  // Social / profile
  update_profile: Record<string, never>;
  send_friend_request: Record<string, never>;
  accept_friend: Record<string, never>;
  gift_knickknack: Record<string, never>;
  share: { method: "copy"; content_type: ShareContent };

  // Navigation
  open_drawer: { drawer: string };
};

export type AnalyticsEvent = keyof AnalyticsEvents;
export type ShareContent = "log_invite" | "friend_invite" | "profile";

/** Log kinds as the app names them: notifications say "ledger", the UI "financial". */
export type LogKindParam = "social" | "financial";
export const logKindParam = (kind: LogKind | LogKindParam): LogKindParam =>
  kind === "social" ? "social" : "financial";

type ParamValue = string | number | boolean;

/** GA stores strings and numbers; booleans become "true"/"false" so reports read cleanly. */
export const toGaParams = (
  params: Record<string, ParamValue> | undefined,
): Record<string, string | number> | undefined =>
  params &&
  Object.fromEntries(
    Object.entries(params).map(([k, v]) => [k, typeof v === "boolean" ? String(v) : v]),
  );

type ParamArgs<E extends AnalyticsEvent> =
  AnalyticsEvents[E] extends Record<string, never> ? [] : [params: AnalyticsEvents[E]];

/**
 * Record one occurrence of `event`. Never throws: analytics is best-effort and must not
 * break the action it describes (and does nothing in the native apps, where GA can't run).
 */
export const track = <E extends AnalyticsEvent>(event: E, ...[params]: ParamArgs<E>): void => {
  try {
    if (!analytics) return;
    logEvent(analytics, event as string, toGaParams(params as Record<string, ParamValue>));
  } catch {
    // Best-effort.
  }
};

/**
 * Route patterns, most specific first, with the readable name used as the page title.
 * Page views report the pattern, not the real path, so `/g/abc` and `/g/xyz` both
 * count towards "/g/:groupId" and no ids reach GA.
 */
export const PAGE_ROUTES: ReadonlyArray<{ pattern: string; title: string }> = [
  { pattern: "/", title: "home" },
  { pattern: "/login", title: "login" },
  { pattern: "/auth/action", title: "auth action" },
  { pattern: "/about", title: "about" },
  { pattern: "/privacy", title: "privacy" },
  { pattern: "/create", title: "create log" },
  { pattern: "/welcome", title: "welcome" },
  { pattern: "/me", title: "me" },
  { pattern: "/notifications", title: "notifications" },
  { pattern: "/admin", title: "admin" },
  { pattern: "/u/:userDocId", title: "profile" },
  { pattern: "/invite/:code", title: "friend invite" },
  { pattern: "/g/:groupId/invite", title: "social log invite" },
  { pattern: "/g/:groupId", title: "social log" },
  { pattern: "/l/:ledgerId/stats", title: "financial log stats" },
  { pattern: "/l/:ledgerId/invite", title: "financial log invite" },
  { pattern: "/l/:ledgerId", title: "financial log" },
];

export type PageInfo = { path: string; title: string };

/** The route pattern and title for a pathname; unknown paths share one bucket. */
export const pageInfo = (pathname: string): PageInfo => {
  for (const { pattern, title } of PAGE_ROUTES) {
    if (matchPath({ path: pattern, end: true }, pathname)) return { path: pattern, title };
  }
  return { path: "(not found)", title: "not found" };
};

/** Send a page view for the route pattern of `pathname` (no ids, query or hash). */
export const trackPageView = (pathname: string, signedIn: boolean): void => {
  const { path, title } = pageInfo(pathname);
  try {
    if (!analytics) return;
    logEvent(analytics, "page_view", {
      page_location: `${window.location.origin}${path}`,
      page_path: path,
      page_title: title,
      signed_in: String(signedIn),
    });
  } catch {
    // Best-effort.
  }
};
