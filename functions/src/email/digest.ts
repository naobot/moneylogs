/**
 * The daily email digest: pure helpers. A notification created for a user whose email
 * prefs let it through stamps `users.emailDigestDueAt` with their next local evening
 * (scheduleEmailDigest). The hourly sendEmailDigests then emails whatever is still
 * unread since the last digest.
 *
 * The copy mirrors src/utils/notificationTypes.ts in plain text. That file imports from
 * the app, so it can't be shared; digest.test.ts checks both cover the same types. A
 * digest goes out hours after the event, so relative times ("ends in 3 hours") become
 * plain statements.
 *
 * Dependency-free, so the root Vitest run can test it.
 */
import { dayIn } from "../knickknacks";
import { wallClockToInstant } from "../logTimeline";
import { isEmailEnabled, isNotificationEnabled } from "../notificationPrefs";

/** Digests go out at the first hourly run after this local hour. */
export const DIGEST_HOUR = 19;
/** No digest lists more than this; the rest are a click away in the inbox. */
export const DIGEST_MAX_ITEMS = 30;

const nextDay = (day: string): string => {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + 1)).toISOString().slice(0, 10);
};

/** The next DIGEST_HOUR:00 in the user's zone after `now`, in ms. UTC for unknown zones. */
export const nextDigestAt = (now: number, timezone?: unknown): number => {
  const zone = typeof timezone === "string" && timezone ? timezone : "UTC";
  const at = (day: string) =>
    wallClockToInstant(`${day}T${String(DIGEST_HOUR).padStart(2, "0")}:00`, zone) ??
    wallClockToInstant(`${day}T${String(DIGEST_HOUR).padStart(2, "0")}:00`, "UTC")!;
  const today = dayIn(now, zone);
  const tonight = at(today);
  return tonight > now ? tonight : at(nextDay(today));
};

/** The notification fields the digest reads. Timestamps are already ms. */
export type DigestNotification = {
  id: string;
  type?: unknown;
  createdAtMs: number;
  read: boolean;
  groupId?: unknown;
  groupName?: unknown;
  logKind?: unknown;
  postId?: unknown;
  commentId?: unknown;
  actorId?: unknown;
  actorName?: unknown;
  excerpt?: unknown;
  reason?: unknown;
  emoji?: unknown;
  month?: unknown;
  currency?: unknown;
  spent?: unknown;
  budget?: unknown;
  projected?: unknown;
  categoryName?: unknown;
};

type PrefsSource = Parameters<typeof isEmailEnabled>[0];

/**
 * What goes in this digest: unread notifications created after the last one, that the
 * user still wants emailed, oldest first. A per-category budget alert also needs
 * budget_category on, as in the inbox.
 */
export const selectDigestItems = (
  items: ReadonlyArray<DigestNotification>,
  user: PrefsSource,
  sinceMs: number,
): DigestNotification[] =>
  items
    .filter((n) => !n.read && n.createdAtMs > sinceMs)
    .filter((n) => isEmailEnabled(user, n.type))
    .filter(
      (n) =>
        typeof n.categoryName !== "string" ||
        !n.categoryName ||
        isNotificationEnabled(user, "budget_category"),
    )
    .sort((a, b) => a.createdAtMs - b.createdAtMs)
    .slice(0, DIGEST_MAX_ITEMS);

const str = (value: unknown, fallback = ""): string =>
  typeof value === "string" && value ? value : fallback;
const num = (value: unknown): number => (typeof value === "number" ? value : 0);

export const formatMoney = (value: unknown, currency: unknown): string => {
  const code = str(currency, "USD");
  try {
    return new Intl.NumberFormat("en", { style: "currency", currency: code }).format(num(value));
  } catch {
    return `${num(value).toFixed(2)} ${code}`;
  }
};

const postHref = (n: DigestNotification): string => {
  const params = new URLSearchParams({ post: str(n.postId) });
  if (str(n.commentId)) params.set("comment", str(n.commentId));
  return `/g/${str(n.groupId)}?${params}`;
};

const logHref = (n: DigestNotification): string =>
  !str(n.groupId)
    ? "/notifications"
    : n.logKind === "ledger"
      ? `/l/${str(n.groupId)}`
      : `/g/${str(n.groupId)}`;

const budgetSubject = (n: DigestNotification): string =>
  str(n.categoryName)
    ? `the ${str(n.categoryName)} ${str(n.currency)} budget`
    : `your ${str(n.currency)} budget`;

const budgetHref = (n: DigestNotification) => `/l/${str(n.groupId)}/stats?month=${str(n.month)}`;

const spentOf = (n: DigestNotification) =>
  `${formatMoney(n.spent, n.currency)} of ${formatMoney(n.budget, n.currency)}`;

export type DigestLine = { text: string; detail?: string; href: string };

type LineSpec = (n: DigestNotification) => DigestLine;

/** One line per type. Keys must match the notification types (see digest.test.ts). */
export const DIGEST_LINES: Record<string, LineSpec> = {
  comment: (n) => ({
    text: `${str(n.actorName, "someone")} commented on ${
      n.reason === "subscriber" ? "a post you follow" : "your post"
    } in ${str(n.groupName, "a log")}`,
    detail: str(n.excerpt) || undefined,
    href: postHref(n),
  }),
  reaction: (n) => ({
    text: `${str(n.actorName, "someone")} reacted ${str(n.emoji)} to your post in ${str(n.groupName, "a log")}`,
    href: postHref(n),
  }),
  log_created: (n) => ({ text: `you started ${str(n.groupName, "a log")}`, href: logHref(n) }),
  log_joined: (n) => ({ text: `you joined ${str(n.groupName, "a log")}`, href: logHref(n) }),
  log_ending: (n) => ({
    text: `${str(n.groupName, "a log")} is about to end: last chance to post`,
    href: logHref(n),
  }),
  log_ended: (n) => ({ text: `${str(n.groupName, "a log")} has ended`, href: logHref(n) }),
  budget_approaching: (n) => ({
    text: `${Math.floor((num(n.spent) / (num(n.budget) || 1)) * 100)}% of ${budgetSubject(n)} used in ${str(n.groupName, "your ledger")}`,
    detail: spentOf(n),
    href: budgetHref(n),
  }),
  budget_exceeded: (n) => ({
    text: `over ${budgetSubject(n)} in ${str(n.groupName, "your ledger")}`,
    detail: spentOf(n),
    href: budgetHref(n),
  }),
  budget_projected: (n) => ({
    text: `on track to go over ${budgetSubject(n)} in ${str(n.groupName, "your ledger")} this month`,
    detail:
      typeof n.projected === "number"
        ? `about ${formatMoney(n.projected, n.currency)} by month end, against ${formatMoney(n.budget, n.currency)}`
        : undefined,
    href: budgetHref(n),
  }),
  friend_request: (n) => ({
    text: `${str(n.actorName, "someone")} wants to be friends`,
    href: `/u/${str(n.actorId)}`,
  }),
  friend_accepted: (n) => ({
    text: `${str(n.actorName, "someone")} accepted your friend request`,
    href: `/u/${str(n.actorId)}`,
  }),
  gift_received: (n) => ({
    text: `${str(n.actorName, "someone")} sent you a gift`,
    detail: "it's waiting, wrapped, in your knick-knack drawer",
    href: "/#knickknacks",
  }),
  milestone_earned: () => ({
    text: "achievement unlocked",
    detail: "your budget buddy has something for you",
    href: "/#knickknacks",
  }),
};

export const digestLine = (n: DigestNotification): DigestLine =>
  DIGEST_LINES[str(n.type)]?.(n) ?? {
    text: `something happened in ${str(n.groupName, "a log")}`,
    href: logHref(n),
  };

export const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

export type RenderedEmail = { subject: string; html: string; text: string };

/**
 * The digest email: one line per notification, each linking into the app. Monochrome
 * and monospace, like the app, with no images, so it reads the same in any client.
 */
export const renderDigest = (args: {
  items: ReadonlyArray<DigestNotification>;
  appUrl: string;
  displayName?: unknown;
  /** One-click "unsubscribe from all email" link, when signing is configured. */
  unsubscribeUrl?: string;
}): RenderedEmail => {
  const base = args.appUrl.replace(/\/+$/, "");
  const lines = args.items.map(digestLine);
  const count = lines.length;
  const subject = `moneylogs: ${count} new ${count === 1 ? "notification" : "notifications"}`;
  const name = str(args.displayName);
  const greeting = name ? `hi ${name},` : "hi,";
  const manageUrl = `${base}/me#notifications`;
  const inboxUrl = `${base}/notifications`;

  const text = [
    greeting,
    "",
    "here's what happened since your last digest:",
    "",
    ...lines.flatMap((l) => [
      `* ${l.text}`,
      ...(l.detail ? [`  ${l.detail}`] : []),
      `  ${base}${l.href}`,
    ]),
    "",
    `all notifications: ${inboxUrl}`,
    "",
    "--",
    `choose what gets emailed: ${manageUrl}`,
    ...(args.unsubscribeUrl ? [`unsubscribe from all email: ${args.unsubscribeUrl}`] : []),
  ].join("\n");

  const font = "Hack, Menlo, Consolas, 'Courier New', monospace";
  const link = (href: string, label: string) =>
    `<a href="${escapeHtml(href)}" style="color:#000;">${escapeHtml(label)}</a>`;
  const items = lines
    .map(
      (l) =>
        `<li style="margin:0 0 14px;">${link(`${base}${l.href}`, l.text)}${
          l.detail ? `<br><span style="color:#444;">${escapeHtml(l.detail)}</span>` : ""
        }</li>`,
    )
    .join("");

  const html = `<!doctype html>
<html><body style="margin:0;padding:24px;background:#fff;color:#000;font-family:${font};font-size:14px;line-height:1.5;">
<div style="max-width:560px;margin:0 auto;border:2px solid #000;padding:20px;">
<h1 style="margin:0 0 16px;font-size:18px;text-transform:lowercase;">moneylogs digest</h1>
<p style="margin:0 0 16px;">${escapeHtml(greeting)} here's what happened since your last digest:</p>
<ul style="margin:0 0 16px;padding-left:18px;">${items}</ul>
<p style="margin:0 0 16px;">${link(inboxUrl, "all notifications")}</p>
<hr style="border:0;border-top:1px solid #000;margin:16px 0;">
<p style="margin:0;font-size:12px;color:#444;">${link(manageUrl, "choose what gets emailed")}${
    args.unsubscribeUrl ? ` · ${link(args.unsubscribeUrl, "unsubscribe from all email")}` : ""
  }</p>
</div>
</body></html>`;

  return { subject, html, text };
};
