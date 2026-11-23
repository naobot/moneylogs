import { onSchedule } from "firebase-functions/v2/scheduler";
import { defineBoolean } from "firebase-functions/params";
import { FieldValue, Firestore, getFirestore } from "firebase-admin/firestore";
import { getAuth, UserRecord } from "firebase-admin/auth";
import {
  cleanupReason,
  CleanupReason,
  hasTies,
  INACTIVE_DAYS,
  lastActiveMs,
  MAX_DELETIONS_PER_RUN,
  Ties,
  type CleanupAccount,
} from "./accountCleanupPlan";
import { deleteUserData } from "./deleteAccount";
import { reportError, withSentry } from "./sentry";

/**
 * Off until someone has looked at the admin preview (/admin → cleanup) and set this to
 * true in functions/.env.<project>, then redeployed. Until then the daily run only logs
 * what it would delete.
 */
export const ACCOUNT_CLEANUP_DELETE = defineBoolean("ACCOUNT_CLEANUP_DELETE", {
  default: false,
  description: "Let the daily account cleanup actually delete accounts (else it only logs).",
});

export type CleanupCandidate = {
  uid: string;
  reason: CleanupReason;
  email: string | null;
  createdAt: string | null;
  lastActiveAt: string | null;
};

const ID_RE = /^[A-Za-z0-9_-]{1,128}$/;

const toAccount = (u: UserRecord): CleanupAccount => ({
  guest: u.providerData.length === 0,
  emailVerified: u.emailVerified,
  admin: u.customClaims?.admin === true,
  creationTime: u.metadata.creationTime,
  lastSignInTime: u.metadata.lastSignInTime,
  lastRefreshTime: u.metadata.lastRefreshTime,
});

/**
 * Friendships (requests included) and logs shared with anyone else. Social logs are
 * found the way deleteAccount and the admin lookup find them.
 */
const tiesOf = async (db: Firestore, uid: string): Promise<Ties> => {
  const friendships = (
    await db.collection("friendships").where("uids", "array-contains", uid).limit(1).get()
  ).size;

  const ledgers = await db.collection("ledgers").where("memberUids", "array-contains", uid).get();
  let sharedLogs = ledgers.docs.filter(
    (d) => ((d.get("memberUids") ?? []) as unknown[]).length > 1,
  ).length;

  const userDocs = (await db.collection("users").where("userId", "==", uid).get()).docs;
  const groupIds = new Set<string>();
  for (const doc of userDocs) {
    for (const id of (doc.get("groups") ?? []) as unknown[]) {
      if (typeof id === "string" && ID_RE.test(id)) groupIds.add(id);
    }
    const memberOf = await db
      .collection("log_groups")
      .where("members", "array-contains", doc.ref)
      .get();
    for (const d of memberOf.docs) groupIds.add(d.id);
  }
  if (groupIds.size) {
    const groups = await db.getAll(
      ...[...groupIds].map((id) => db.collection("log_groups").doc(id)),
    );
    sharedLogs += groups.filter(
      (g) => g.exists && ((g.get("members") ?? []) as unknown[]).length > 1,
    ).length;
  }
  return { friendships, sharedLogs };
};

/** Whether this account should go now, re-read fresh: null to keep it. */
const candidateFor = async (
  db: Firestore,
  user: UserRecord,
  nowMs: number,
): Promise<CleanupCandidate | null> => {
  const account = toAccount(user);
  const reason = cleanupReason(account, nowMs);
  if (!reason) return null;
  if (reason === "idle_unconfirmed" && hasTies(await tiesOf(db, user.uid))) return null;
  const last = lastActiveMs(account);
  return {
    uid: user.uid,
    reason,
    email: user.email ?? null,
    createdAt: user.metadata.creationTime
      ? new Date(user.metadata.creationTime).toISOString()
      : null,
    lastActiveAt: last ? new Date(last).toISOString() : null,
  };
};

/** Every account the cleanup would remove right now, oldest activity first. */
export const findCleanupCandidates = async (
  db: Firestore,
  nowMs = Date.now(),
): Promise<CleanupCandidate[]> => {
  const found: CleanupCandidate[] = [];
  let pageToken: string | undefined;
  do {
    const page = await getAuth().listUsers(1000, pageToken);
    for (const user of page.users) {
      const candidate = await candidateFor(db, user, nowMs);
      if (candidate) found.push(candidate);
    }
    pageToken = page.pageToken;
  } while (pageToken);
  return found.sort((a, b) => (a.lastActiveAt ?? "").localeCompare(b.lastActiveAt ?? ""));
};

/**
 * Daily: remove idle guests and idle, unconnected unconfirmed accounts (see
 * accountCleanupPlan.ts), at most MAX_DELETIONS_PER_RUN at a time, each recorded in
 * admin_actions. Only logs what it would do while ACCOUNT_CLEANUP_DELETE is off.
 */
export const cleanupAccounts = onSchedule(
  {
    schedule: "every day 04:00",
    timeZone: "America/Vancouver",
    timeoutSeconds: 540,
    memory: "512MiB",
  },
  withSentry("cleanupAccounts", async () => {
    const db = getFirestore();
    const candidates = await findCleanupCandidates(db);
    const counts = candidates.reduce<Record<string, number>>(
      (acc, c) => ({ ...acc, [c.reason]: (acc[c.reason] ?? 0) + 1 }),
      {},
    );
    if (!ACCOUNT_CLEANUP_DELETE.value()) {
      console.log(
        `cleanupAccounts: would delete ${candidates.length} (${JSON.stringify(counts)}); deletion is off`,
      );
      return;
    }

    let deleted = 0;
    for (const candidate of candidates.slice(0, MAX_DELETIONS_PER_RUN)) {
      try {
        // Re-check against a fresh record: they may have come back since the scan.
        const fresh = await getAuth().getUser(candidate.uid);
        if (!(await candidateFor(db, fresh, Date.now()))) continue;
        const result = await deleteUserData(db, candidate.uid);
        await db.collection("admin_actions").add({
          action: "cleanup_account",
          adminUid: "system",
          target: { uid: candidate.uid },
          details: {
            reason: candidate.reason,
            email: candidate.email,
            lastActiveAt: candidate.lastActiveAt,
            ...result,
          },
          at: FieldValue.serverTimestamp(),
        });
        deleted += 1;
      } catch (error) {
        reportError(error, { action: "cleanup_account", level: "warning" });
      }
    }
    console.log(
      `cleanupAccounts: deleted ${deleted} of ${candidates.length} (${JSON.stringify(counts)}); ` +
        `idle for ${INACTIVE_DAYS}+ days`,
    );
  }),
);
