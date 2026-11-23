import { matchPath } from "react-router-dom";
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
 *
 * This module doesn't import Firebase: firebase-config hands it a sink at startup. So
 * shared components (Drawer, CopyTextArea) can call `track` without pulling Firebase
 * into their own imports, e.g. in visual tests where there's no API key. Until a sink
 * is set (native apps, tests), events are dropped.
 */
export type AnalyticsEvents = {
  // Accounts (GA recommended event names)
  /** `guest`: a guest saved their account (src/features/auth/guest.ts). */
  sign_up: { method: "email" | "guest" };
  /** Started as a guest, without an account. */
  try_as_guest: Record<string, never>;
  login: { method: "email" };
  tutorial_complete: { tutorial: "welcome" | "ledger_tour" | "first_post" };
  /** The "confirm your email" modal: shown before reaching out, link resent, confirmed. */
  confirm_email: { action: "prompt" | "resend" | "confirmed" };

  // Logs
  create_log: { log_kind: LogKindParam; invited_friends: number };
  join_log: { log_kind: LogKindParam };
  archive_log: { log_kind: LogKindParam; archived: boolean };
  delete_log: { log_kind: LogKindParam };
  rename_log: { log_kind: LogKindParam };
  invite_friends_to_log: { log_kind: LogKindParam; invited_friends: number };

  // Social logs
  add_post: { travelling: boolean };
  /** Financial-log entries pulled into a social post: how many logs and entries. */
  pull_ledger_spending: { ledgers: number; entries: number };
  open_comments: { has_comments: boolean };
  add_comment: Record<string, never>;
  add_reaction: Record<string, never>;

  // Financial logs (ledgers)
  add_entry: { shared_log: boolean; has_note: boolean };
  import_entries: { source: string; created: number };
  no_spend_day: Record<string, never>;
  delete_category: Record<string, never>;
  /** A scheduled payment on a fixed category: set up, paused or resumed, removed. */
  schedule_payment: { action: "create" | "pause" | "resume" | "delete"; repeat: "month" | "year" };
  remove_budget: Record<string, never>;
  monthly_total: { action: "set" | "remove" };
  stats_period: { period: "month" | "quarter" | "year" };
  stats_sort: { sort: "order" | "amount" | "pace" };
  month_review: { action: "start" | "snooze" | "dismiss" | "adjust" | "keep" };
  /** A log made a sublog of another: from the create wizard or its log actions. */
  sublog_linked: { from: "wizard" | "log_actions"; include_past: boolean; shared_parent: boolean };
  /** A sublog link ended, from the sublog's side or the parent's. */
  sublog_unlinked: { from: "sublog" | "parent" };
  /** The "what's a sublog?" slides closed: where they opened, and whether read to the end. */
  sublog_intro: {
    from: "home" | "wizard" | "link_form" | "visit" | "help";
    result: "finished" | "skipped";
  };

  // Social / profile
  update_profile: Record<string, never>;
  send_friend_request: Record<string, never>;
  accept_friend: Record<string, never>;
  gift_knickknack: Record<string, never>;
  send_nudge: { kind: "poke" | "cheer" };
  read_nudge: Record<string, never>;
  share: { method: "copy"; content_type: ShareContent };
  share_card: {
    card: "daily" | "breakdown";
    format: "story" | "square";
    result: ShareCardResult;
    /** How many photos the sharer added (0–3). */
    photos: number;
    amounts: boolean;
  };

  // Display
  chart_colours: { charts: "colour" | "mono" };

  // Navigation
  open_me_section: { section: string };
};

export type AnalyticsEvent = keyof AnalyticsEvents;
export type ShareContent = "log_invite" | "friend_invite" | "profile";
/** How a share card left the app: the share sheet, dismissed, or saved as a download. */
export type ShareCardResult = "shared" | "cancelled" | "downloaded";

/** Log kinds as the app names them: notifications say "ledger", the UI "financial". */
export type LogKindParam = "social" | "financial";
export const logKindParam = (kind: LogKind | LogKindParam): LogKindParam =>
  kind === "social" ? "social" : "financial";

type ParamValue = string | number | boolean;
export type GaParams = Record<string, string | number>;
export type AnalyticsSink = (event: string, params?: GaParams) => void;

let sink: AnalyticsSink | null = null;

/** Where events go; set once by firebase-config when Analytics is available. */
export const setAnalyticsSink = (next: AnalyticsSink | null): void => {
  sink = next;
};

/** GA stores strings and numbers; booleans become "true"/"false" so reports read cleanly. */
export const toGaParams = (params: Record<string, ParamValue> | undefined): GaParams | undefined =>
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
    sink?.(event, toGaParams(params as Record<string, ParamValue> | undefined));
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
    sink?.("page_view", {
      page_location: `${window.location.origin}${path}`,
      page_path: path,
      page_title: title,
      signed_in: String(signedIn),
    });
  } catch {
    // Best-effort.
  }
};
