import { onDocumentCreated } from "firebase-functions/v2/firestore";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { getAuth } from "firebase-admin/auth";
import { FieldValue, getFirestore, Timestamp } from "firebase-admin/firestore";
import { DigestNotification, nextDigestAt, renderDigest, selectDigestItems } from "./email/digest";
import { APP_URL, RESEND_API_KEY, sendEmail } from "./email/resend";
import { unsubscribeHeaders, unsubscribeUrl } from "./email/unsubscribe";
import { UNSUBSCRIBE_SECRET, unsubscribeSecret } from "./emailUnsubscribe";
import { reportError, withSentry } from "./sentry";

/** A first digest (or one after a long pause) looks back at most this far. */
const LOOKBACK_MS = 7 * 24 * 60 * 60 * 1000;
/** When a send fails, try that user again after this long. */
const RETRY_MS = 60 * 60 * 1000;
/** Users handled per hourly run. Anyone left over is still due next hour. */
const USERS_PER_RUN = 200;

const toMillis = (value: unknown): number | undefined =>
  value instanceof Timestamp ? value.toMillis() : undefined;

const asDigestItem = (id: string, data: FirebaseFirestore.DocumentData): DigestNotification => ({
  ...data,
  id,
  createdAtMs: toMillis(data.createdAt) ?? Date.now(),
  read: !!data.readAt,
});

/**
 * A new inbox notification that the recipient wants emailed books their next digest
 * (their next local evening), unless one is already booked. Every writer, client or
 * server, is covered here without knowing about email.
 */
export const scheduleEmailDigest = onDocumentCreated(
  "users/{userDocId}/notifications/{notificationId}",
  withSentry("scheduleEmailDigest", async (event) => {
    const data = event.data?.data();
    if (!data) return;
    const db = getFirestore();
    const userRef = db.collection("users").doc(event.params.userDocId);
    const item = asDigestItem(event.params.notificationId, data);

    await db.runTransaction(async (tx) => {
      const user = await tx.get(userRef);
      const userData = user.data();
      if (!userData || userData.emailDigestDueAt) return;
      if (!selectDigestItems([item], userData, -Infinity).length) return;
      tx.update(userRef, {
        emailDigestDueAt: Timestamp.fromMillis(nextDigestAt(Date.now(), userData.timezone)),
      });
    });
  }),
);

/** The verified sign-in address for a user doc, or null if there isn't one. */
const verifiedEmailOf = async (authUid: unknown): Promise<string | null> => {
  if (typeof authUid !== "string" || !authUid) return null;
  try {
    const record = await getAuth().getUser(authUid);
    return record.email && record.emailVerified ? record.email : null;
  } catch (err) {
    if ((err as { code?: string })?.code === "auth/user-not-found") return null;
    throw err;
  }
};

/**
 * Hourly: email everyone whose digest is due. Due users come from a single-field range
 * on `emailDigestDueAt`, so no full user scan and no composite index. Each user is
 * claimed in a transaction (due time cleared, lastSent stamped) before sending, so
 * overlapping runs can't email anyone twice; a failed send books a retry.
 */
export const sendEmailDigests = onSchedule(
  {
    schedule: "every 60 minutes",
    timeoutSeconds: 540,
    secrets: [RESEND_API_KEY, UNSUBSCRIBE_SECRET],
  },
  withSentry("sendEmailDigests", async () => {
    const db = getFirestore();
    const now = Date.now();
    const due = await db
      .collection("users")
      .where("emailDigestDueAt", "<=", Timestamp.fromMillis(now))
      .limit(USERS_PER_RUN)
      .get();

    let sent = 0;
    for (const snap of due.docs) {
      const userRef = snap.ref;
      try {
        // Claim: only the run that clears the due time sends.
        const claimed = await db.runTransaction(async (tx) => {
          const fresh = await tx.get(userRef);
          const dueAt = toMillis(fresh.data()?.emailDigestDueAt);
          if (dueAt === undefined || dueAt > now) return null;
          tx.update(userRef, {
            emailDigestDueAt: FieldValue.delete(),
            emailDigestLastSentAt: Timestamp.fromMillis(now),
          });
          return fresh.data()!;
        });
        if (!claimed) continue;

        const to = await verifiedEmailOf(claimed.userId);
        if (!to) continue;

        const since = Math.max(toMillis(claimed.emailDigestLastSentAt) ?? 0, now - LOOKBACK_MS);
        const recent = await userRef
          .collection("notifications")
          .where("createdAt", ">", Timestamp.fromMillis(since))
          .orderBy("createdAt", "desc")
          .limit(50)
          .get();
        const items = selectDigestItems(
          recent.docs.map((doc) => asDigestItem(doc.id, doc.data())),
          claimed,
          since,
        );
        if (!items.length) continue;

        const appUrl = APP_URL.value();
        const unsubscribe = unsubscribeUrl(appUrl, unsubscribeSecret(), snap.id);
        const email = renderDigest({
          items,
          appUrl,
          displayName: claimed.displayName,
          timezone: claimed.timezone,
          now,
          unsubscribeUrl: unsubscribe ?? undefined,
        });
        try {
          await sendEmail({
            to,
            ...email,
            headers: unsubscribe ? unsubscribeHeaders(unsubscribe) : undefined,
          });
          sent += 1;
        } catch (err) {
          // Put the claim back an hour out, keeping the old cutoff so nothing is skipped.
          await userRef.update({
            emailDigestDueAt: Timestamp.fromMillis(now + RETRY_MS),
            emailDigestLastSentAt: claimed.emailDigestLastSentAt ?? FieldValue.delete(),
          });
          throw err;
        }
      } catch (err) {
        reportError(err, { action: "send_email_digest", extra: { userDocId: snap.id } });
      }
    }
    console.log(`sendEmailDigests: ${due.size} due, ${sent} sent`);
  }),
);
