import { onRequest } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import { getFirestore } from "firebase-admin/firestore";
import { APP_URL } from "./email/resend";
import {
  confirmPage,
  donePage,
  invalidPage,
  unsubscribePatch,
  verifyUnsubscribe,
} from "./email/unsubscribe";
import { reportError, withSentry } from "./sentry";

/** Signs and checks unsubscribe links: `firebase functions:secrets:set UNSUBSCRIBE_SECRET`. */
export const UNSUBSCRIBE_SECRET = defineSecret("UNSUBSCRIBE_SECRET");

/** The secret's value, or "" when it isn't set (the emulator without .secret.local). */
export const unsubscribeSecret = (): string => {
  try {
    return UNSUBSCRIBE_SECRET.value() ?? "";
  } catch {
    return "";
  }
};

/**
 * `/email/unsubscribe?u=&s=&sig=` (a Hosting rewrite). GET confirms; POST, from the
 * confirm button or a mail client's one-click (RFC 8058), switches the email off.
 */
export const emailUnsubscribe = onRequest(
  { secrets: [UNSUBSCRIBE_SECRET] },
  withSentry("emailUnsubscribe", async (req, res) => {
    const manageUrl = `${APP_URL.value().replace(/\/+$/, "")}/me#notifications`;
    res.set("Cache-Control", "no-store");
    res.set("Content-Type", "text/html; charset=utf-8");

    const { u, s, sig } = req.query;
    if (!verifyUnsubscribe(unsubscribeSecret(), u, s, sig)) {
      res.status(400).send(invalidPage(manageUrl));
      return;
    }
    const scope = s;

    if (req.method === "GET" || req.method === "HEAD") {
      res.status(200).send(confirmPage(scope, manageUrl));
      return;
    }
    if (req.method !== "POST") {
      res.status(405).set("Allow", "GET, POST").send("");
      return;
    }

    try {
      const userRef = getFirestore()
        .collection("users")
        .doc(u as string);
      const user = await userRef.get();
      // A deleted account has nothing left to unsubscribe from: still say done.
      if (user.exists) await userRef.update(unsubscribePatch(scope));
    } catch (err) {
      reportError(err, { action: "email_unsubscribe", extra: { scope } });
      res.status(500).send(invalidPage(manageUrl));
      return;
    }
    res.status(200).send(donePage(scope, manageUrl));
  }),
);
