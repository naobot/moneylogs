/**
 * Signed unsubscribe links that work without signing in. A link names a user doc and a
 * scope (one notification type, or "all") and carries an HMAC of both, so it can only
 * switch off email, only for that user, and can't be altered to do anything else.
 *
 * Pure (node:crypto only), so the root Vitest run can test it.
 */
import { createHmac, timingSafeEqual } from "node:crypto";
import { EmailPrefKey, isEmailPrefKey, NEVER_EMAILED } from "../notificationPrefs";

export type UnsubscribeScope = "all" | EmailPrefKey;

/** Served through a Hosting rewrite (firebase.json) on the app's own domain. */
export const UNSUBSCRIBE_PATH = "/email/unsubscribe";

export const isUnsubscribeScope = (value: unknown): value is UnsubscribeScope =>
  value === "all" || (isEmailPrefKey(value) && !NEVER_EMAILED.has(value));

export const signUnsubscribe = (secret: string, userDocId: string, scope: UnsubscribeScope) =>
  createHmac("sha256", secret).update(`unsubscribe:${userDocId}:${scope}`).digest("base64url");

export const verifyUnsubscribe = (
  secret: string,
  userDocId: unknown,
  scope: unknown,
  signature: unknown,
): scope is UnsubscribeScope => {
  if (!secret || typeof userDocId !== "string" || !userDocId) return false;
  if (!isUnsubscribeScope(scope) || typeof signature !== "string") return false;
  const expected = Buffer.from(signUnsubscribe(secret, userDocId, scope));
  const given = Buffer.from(signature);
  return expected.length === given.length && timingSafeEqual(expected, given);
};

/** The link for an email footer and the List-Unsubscribe header; null without a secret. */
export const unsubscribeUrl = (
  appUrl: string,
  secret: string,
  userDocId: string,
  scope: UnsubscribeScope = "all",
): string | null => {
  if (!secret) return null;
  const params = new URLSearchParams({
    u: userDocId,
    s: scope,
    sig: signUnsubscribe(secret, userDocId, scope),
  });
  return `${appUrl.replace(/\/+$/, "")}${UNSUBSCRIBE_PATH}?${params}`;
};

/** RFC 8058 one-click headers, so mail clients can show their own unsubscribe button. */
export const unsubscribeHeaders = (url: string): Record<string, string> => ({
  "List-Unsubscribe": `<${url}>`,
  "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
});

/** The user-doc update for a scope: pause everything, or switch one type's email off. */
export const unsubscribePatch = (scope: UnsubscribeScope): Record<string, boolean> =>
  scope === "all" ? { emailPaused: true } : { [`emailPrefs.${scope}`]: false };

export const scopeLabel = (scope: UnsubscribeScope): string =>
  scope === "all" ? "all moneylogs email" : `"${scope.replace(/_/g, " ")}" emails`;

const page = (title: string, body: string) => `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title></head>
<body style="margin:0;padding:24px 16px;background:#fff;color:#000;font-family:Hack,Menlo,Consolas,'Courier New',monospace;font-size:15px;line-height:1.5;">
<main style="max-width:480px;margin:0 auto;border:2px solid #000;padding:20px;">${body}</main>
</body></html>`;

const button =
  "font:inherit;font-weight:700;text-transform:uppercase;background:#000;color:#fff;border:2px solid #000;padding:8px 16px;cursor:pointer;";

/**
 * GET shows a confirm button: link scanners and previews follow GETs, so a GET alone
 * never unsubscribes. The form posts back to the same signed URL.
 */
export const confirmPage = (scope: UnsubscribeScope, manageUrl: string) =>
  page(
    "unsubscribe",
    `<h1 style="margin:0 0 12px;font-size:18px;">unsubscribe</h1>
<p>Stop ${scopeLabel(scope)}? Your in-app notifications won't change.</p>
<form method="post"><button type="submit" style="${button}">Unsubscribe</button></form>
<p style="font-size:13px;">Or <a href="${manageUrl}" style="color:#000;">choose what gets emailed</a>.</p>`,
  );

export const donePage = (scope: UnsubscribeScope, manageUrl: string) =>
  page(
    "unsubscribed",
    `<h1 style="margin:0 0 12px;font-size:18px;">unsubscribed</h1>
<p>You won't get ${scopeLabel(scope)} any more.</p>
<p style="font-size:13px;">Changed your mind? <a href="${manageUrl}" style="color:#000;">Email settings</a>.</p>`,
  );

export const invalidPage = (manageUrl: string) =>
  page(
    "link not valid",
    `<h1 style="margin:0 0 12px;font-size:18px;">this link isn't valid</h1>
<p>It may have been cut short. You can switch email off in <a href="${manageUrl}" style="color:#000;">your settings</a>.</p>`,
  );
