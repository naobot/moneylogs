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

const budgetHref = (n: DigestNotification) => `/l/${str(n.groupId)}/stats?month=${str(n.month)}`;

const spentOf = (n: DigestNotification) =>
  `${formatMoney(n.spent, n.currency)} of ${formatMoney(n.budget, n.currency)}`;

/**
 * A line of digest copy. Plain strings are the app's lowercase voice; `{ name }` parts
 * are user content (names, log titles), shown bold and in their own case.
 */
export type DigestPart = string | { name: string };

/** The digest's sections, in the order they're shown. Mirrors the /me drawer's groups. */
export const DIGEST_SECTIONS = ["logs", "budgets", "posts", "friends & finds", "other"] as const;
export type DigestSection = (typeof DIGEST_SECTIONS)[number];

export type DigestLine = {
  section: DigestSection;
  parts: DigestPart[];
  /** A secondary line: amounts, or a hint. */
  detail?: string;
  /** Someone's own words (a comment excerpt), shown in a speech bubble. */
  quote?: string;
  href: string;
};

type LineSpec = (n: DigestNotification) => DigestLine;

const name = (value: unknown, fallback: string): DigestPart =>
  str(value) ? { name: str(value) } : fallback;

const budgetSubject = (n: DigestNotification): DigestPart[] =>
  str(n.categoryName)
    ? ["the ", { name: str(n.categoryName) }, ` ${str(n.currency)} budget`]
    : [`your ${str(n.currency)} budget`];

const ledgerName = (n: DigestNotification) => name(n.groupName, "your ledger");
const logName = (n: DigestNotification) => name(n.groupName, "a log");
const someone = (n: DigestNotification) => name(n.actorName, "someone");

/** One line per type. Keys must match the notification types (see digest.test.ts). */
export const DIGEST_LINES: Record<string, LineSpec> = {
  comment: (n) => ({
    section: "posts",
    parts: [
      someone(n),
      n.reason === "subscriber"
        ? " commented on a post you follow in "
        : " commented on your post in ",
      logName(n),
    ],
    quote: str(n.excerpt) || undefined,
    href: postHref(n),
  }),
  reaction: (n) => ({
    section: "posts",
    parts: [someone(n), ` reacted ${str(n.emoji)} to your post in `, logName(n)],
    href: postHref(n),
  }),
  log_created: (n) => ({ section: "logs", parts: ["you started ", logName(n)], href: logHref(n) }),
  log_joined: (n) => ({ section: "logs", parts: ["you joined ", logName(n)], href: logHref(n) }),
  log_ending: (n) => ({
    section: "logs",
    parts: [logName(n), " is about to end"],
    detail: "last chance to post",
    href: logHref(n),
  }),
  log_ended: (n) => ({
    section: "logs",
    parts: [logName(n), " has ended"],
    href: logHref(n),
  }),
  budget_approaching: (n) => ({
    section: "budgets",
    parts: [
      `${Math.floor((num(n.spent) / (num(n.budget) || 1)) * 100)}% of `,
      ...budgetSubject(n),
      " used in ",
      ledgerName(n),
    ],
    detail: spentOf(n),
    href: budgetHref(n),
  }),
  budget_exceeded: (n) => ({
    section: "budgets",
    parts: ["over ", ...budgetSubject(n), " in ", ledgerName(n)],
    detail: spentOf(n),
    href: budgetHref(n),
  }),
  budget_projected: (n) => ({
    section: "budgets",
    parts: ["on track to go over ", ...budgetSubject(n), " in ", ledgerName(n), " this month"],
    detail:
      typeof n.projected === "number"
        ? `about ${formatMoney(n.projected, n.currency)} by month end, against ${formatMoney(n.budget, n.currency)}`
        : undefined,
    href: budgetHref(n),
  }),
  friend_request: (n) => ({
    section: "friends & finds",
    parts: [someone(n), " wants to be friends"],
    href: `/u/${str(n.actorId)}`,
  }),
  friend_accepted: (n) => ({
    section: "friends & finds",
    parts: [someone(n), " accepted your friend request"],
    href: `/u/${str(n.actorId)}`,
  }),
  gift_received: (n) => ({
    section: "friends & finds",
    parts: [someone(n), " sent you a gift"],
    detail: "it's waiting, wrapped, in your knick-knack drawer",
    href: "/#knickknacks",
  }),
  milestone_earned: () => ({
    section: "friends & finds",
    parts: ["achievement unlocked"],
    detail: "your budget buddy has something for you",
    href: "/#knickknacks",
  }),
};

export const digestLine = (n: DigestNotification): DigestLine =>
  DIGEST_LINES[str(n.type)]?.(n) ?? {
    section: "other",
    parts: ["something happened in ", logName(n)],
    href: logHref(n),
  };

/** A line's copy as plain text. */
export const lineText = (parts: ReadonlyArray<DigestPart>): string =>
  parts.map((p) => (typeof p === "string" ? p : p.name)).join("");

export const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

/** Lines grouped by section, sections in DIGEST_SECTIONS order, lines in their order. */
export const groupLines = (lines: ReadonlyArray<DigestLine>) =>
  DIGEST_SECTIONS.map((section) => ({
    section,
    lines: lines.filter((l) => l.section === section),
  })).filter((g) => g.lines.length);

/** "tue 17 nov" in the user's zone. */
export const digestDate = (now: number, timezone?: unknown): string => {
  const format = (timeZone: string) =>
    new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone })
      .format(now)
      .replace(",", "")
      .toLowerCase();
  try {
    return format(str(timezone, "UTC"));
  } catch {
    return format("UTC");
  }
};

export type RenderedEmail = { subject: string; html: string; text: string };

// The app's two inks (src/tokens.scss). Email can't read CSS custom properties, so the
// values are written out here; Night shift is swapped in by the dark-mode <style> block.
const PAPER = "#f5f3f0";
const SHEET = "#ffffff";
const INK = "#242424";
const MUTED = "#666666"; // --ink-muted (0.7) flattened onto the sheet
const NIGHT_MUTED = "#b8b6b4"; // the same, onto the night sheet
const FONT = "Hack, Menlo, Consolas, 'DejaVu Sans Mono', 'Courier New', monospace";

/**
 * Styles that only some clients honour (web fonts, dark mode). Everything essential is
 * inline as well, so Gmail, which drops most of this, still shows the light design.
 */
const headStyles = (assets: string) => `
@font-face { font-family: Hack; font-weight: 400; font-style: normal;
  src: url("${assets}/Hack-regular.woff2") format("woff2"); }
@font-face { font-family: Hack; font-weight: 700; font-style: normal;
  src: url("${assets}/Hack-bold.woff2") format("woff2"); }
a { color: ${INK}; }
@media (max-width: 600px) {
  .ml-pad { padding-left: 16px !important; padding-right: 16px !important; }
}
@media (prefers-color-scheme: dark) {
  .ml-bg, .ml-window, .ml-label, .ml-bubble { background-color: ${INK} !important; }
  .ml-bar { background-color: ${INK} !important;
    background-image: url("${assets}/stripe-night.png") !important; }
  .ml-ink, .ml-ink a, .ml-label, .ml-bubble { color: ${PAPER} !important; }
  .ml-muted, .ml-muted a { color: ${NIGHT_MUTED} !important; }
  .ml-window, .ml-bar, .ml-rule, .ml-bubble { border-color: ${PAPER} !important; }
  .ml-btn { background-color: ${PAPER} !important; }
  .ml-btn a { color: ${INK} !important; }
}`;

/**
 * The digest email. It's laid out like an app window: a striped title bar over a
 * framed sheet, lowercase headings, bold names, comment excerpts in speech bubbles and
 * an inverted button. Table layout and inline styles, so it holds together in Gmail
 * and Outlook; web fonts and the Night shift palette are extras for clients that allow
 * them. The striped bar is a hosted 1×2 PNG (public/mail/) because email can't draw the
 * app's CSS-mask textures; without images it falls back to a plain paper bar.
 */
export const renderDigest = (args: {
  items: ReadonlyArray<DigestNotification>;
  appUrl: string;
  displayName?: unknown;
  timezone?: unknown;
  now?: number;
  /** One-click "unsubscribe from all email" link, when signing is configured. */
  unsubscribeUrl?: string;
}): RenderedEmail => {
  const base = args.appUrl.replace(/\/+$/, "");
  const assets = `${base}/mail`;
  const lines = args.items.map(digestLine);
  const groups = groupLines(lines);
  const count = lines.length;
  const things = `${count} ${count === 1 ? "thing" : "things"}`;
  const subject = `moneylogs: ${count} new ${count === 1 ? "notification" : "notifications"}`;
  const userName = str(args.displayName);
  const greeting = userName ? `hi ${userName},` : "hi,";
  const intro = `${things} happened since your last digest.`;
  const date = digestDate(args.now ?? Date.now(), args.timezone);
  const manageUrl = `${base}/me#notifications`;
  const inboxUrl = `${base}/notifications`;

  const text = [
    `moneylogs digest · ${date}`,
    "",
    greeting,
    intro,
    ...groups.flatMap((g) => [
      "",
      `== ${g.section} ==`,
      ...g.lines.flatMap((l) => [
        `> ${lineText(l.parts)}`,
        ...(l.quote ? [`  "${l.quote}"`] : []),
        ...(l.detail ? [`  ${l.detail}`] : []),
        `  ${base}${l.href}`,
      ]),
    ]),
    "",
    `open your inbox: ${inboxUrl}`,
    "",
    "--",
    "you're getting this because email is on in your moneylogs settings.",
    `choose what gets emailed: ${manageUrl}`,
    ...(args.unsubscribeUrl ? [`unsubscribe from all email: ${args.unsubscribeUrl}`] : []),
  ].join("\n");

  const e = escapeHtml;
  const partsHtml = (parts: ReadonlyArray<DigestPart>) =>
    parts
      .map((p) =>
        typeof p === "string" ? e(p) : `<strong style="font-weight:700;">${e(p.name)}</strong>`,
      )
      .join("");

  const lineHtml = (l: DigestLine) => `
<tr>
  <td class="ml-ink" valign="top" width="18" style="width:18px;padding:6px 0;color:${INK};font-weight:700;">&rsaquo;</td>
  <td valign="top" style="padding:6px 0;">
    <a class="ml-ink" href="${e(`${base}${l.href}`)}" style="color:${INK};text-decoration:none;">${partsHtml(l.parts)}</a>${
      l.quote
        ? `
    <div class="ml-bubble" style="margin:6px 0 2px;padding:6px 10px;border:1px solid ${INK};border-radius:10px;background-color:${SHEET};color:${INK};">${e(l.quote)}</div>`
        : ""
    }${
      l.detail
        ? `
    <div class="ml-muted" style="margin-top:2px;font-size:13px;color:${MUTED};">${e(l.detail)}</div>`
        : ""
    }
  </td>
</tr>`;

  const sections = groups
    .map(
      (g) => `
<tr><td class="ml-pad" style="padding:20px 28px 0;">
  <div class="ml-ink ml-rule" style="padding-bottom:4px;border-bottom:1px solid ${INK};color:${INK};font-size:13px;font-weight:700;text-transform:lowercase;">${e(g.section)}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:4px;">${g.lines
    .map(lineHtml)
    .join("")}
  </table>
</td></tr>`,
    )
    .join("");

  const label = (content: string) =>
    `<td class="ml-label" style="padding:0 6px;background-color:${PAPER};color:${INK};font-weight:700;white-space:nowrap;">${content}</td>`;

  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light dark">
<meta name="supported-color-schemes" content="light dark">
<title>${e(subject)}</title>
<style>${headStyles(assets)}
</style>
</head>
<body class="ml-bg" style="margin:0;padding:0;background-color:${PAPER};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${e(`${intro} ${lines.length ? lineText(lines[0].parts) : ""}`)}</div>
<table role="presentation" class="ml-bg" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:${PAPER};">
<tr><td align="center" style="padding:24px 12px;">
<table role="presentation" class="ml-window" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;background-color:${SHEET};border:2px solid ${INK};font-family:${FONT};font-size:14px;line-height:1.5;color:${INK};">
<tr><td class="ml-bar" style="padding:5px 8px;background-color:${PAPER};background-image:url('${assets}/stripe.png');background-repeat:repeat;border-bottom:2px solid ${INK};font-size:13px;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
    ${label("moneylogs digest")}
    <td style="width:100%;">&nbsp;</td>
    ${label(e(date))}
  </tr></table>
</td></tr>
<tr><td class="ml-pad ml-ink" style="padding:24px 28px 0;color:${INK};">
  <div style="font-size:18px;font-weight:700;">${userName ? `hi <span style="text-transform:none;">${e(userName)}</span>,` : "hi,"}</div>
  <div class="ml-muted" style="margin-top:4px;color:${MUTED};">${e(intro)}</div>
</td></tr>${sections}
<tr><td class="ml-pad" style="padding:24px 28px 28px;">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
    <td class="ml-btn" style="background-color:${INK};">
      <a href="${e(inboxUrl)}" style="display:inline-block;padding:10px 18px;color:${PAPER};font-family:${FONT};font-size:13px;font-weight:700;letter-spacing:0.04em;text-transform:uppercase;text-decoration:none;">Open inbox</a>
    </td>
  </tr></table>
</td></tr>
<tr><td class="ml-pad ml-muted ml-rule" style="padding:12px 28px 16px;border-top:1px dotted ${INK};font-size:12px;color:${MUTED};">
  you're getting this because email is on in your moneylogs settings.<br>
  <a href="${e(manageUrl)}" style="color:${MUTED};">choose what gets emailed</a>${
    args.unsubscribeUrl
      ? ` &middot; <a href="${e(args.unsubscribeUrl)}" style="color:${MUTED};">unsubscribe from all email</a>`
      : ""
  }
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;

  return { subject, html, text };
};
