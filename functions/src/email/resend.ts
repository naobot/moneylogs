import { defineSecret, defineString } from "firebase-functions/params";
import { logger } from "firebase-functions";

/**
 * Sending email through Resend's HTTP API (https://resend.com/docs/api-reference).
 * Set up once: verify the sending domain in Resend, then
 *   firebase functions:secrets:set RESEND_API_KEY
 * and give EMAIL_FROM / APP_URL values when `firebase deploy` asks (or in functions/.env).
 */
export const RESEND_API_KEY = defineSecret("RESEND_API_KEY");
/** e.g. "moneylogs <digest@mail.example.com>": must be on the verified domain. */
export const EMAIL_FROM = defineString("EMAIL_FROM", {
  default: "moneylogs <digest@example.com>",
});
/** Where links in emails point, without a trailing slash. */
export const APP_URL = defineString("APP_URL", { default: "https://moneylogs.app" });

export type OutgoingEmail = {
  to: string;
  subject: string;
  html: string;
  text: string;
  headers?: Record<string, string>;
};

export type SendResult = { sent: boolean; id?: string };

/**
 * Under the emulator, or with no API key, logs the email instead of sending it, so the
 * digest can be tried locally without a real address.
 */
export const sendEmail = async (email: OutgoingEmail): Promise<SendResult> => {
  const key = process.env.FUNCTIONS_EMULATOR === "true" ? "" : RESEND_API_KEY.value();
  if (!key) {
    logger.info("email (not sent: no RESEND_API_KEY or running in the emulator)", {
      subject: email.subject,
      headers: email.headers,
      text: email.text,
    });
    return { sent: false };
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: EMAIL_FROM.value(),
      to: [email.to],
      subject: email.subject,
      html: email.html,
      text: email.text,
      headers: email.headers,
    }),
  });
  if (!response.ok) {
    // The body can quote the recipient, so it stays in the function logs, not Sentry.
    const body = await response.text().catch(() => "");
    logger.warn("Resend rejected an email", { status: response.status, body: body.slice(0, 500) });
    throw new Error(`Resend responded ${response.status}`);
  }
  const data = (await response.json().catch(() => ({}))) as { id?: string };
  return { sent: true, id: data.id };
};
