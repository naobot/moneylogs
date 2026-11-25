import { onSchedule } from "firebase-functions/v2/scheduler";
import { FieldValue, Firestore, getFirestore } from "firebase-admin/firestore";
import { getAuth, UserRecord } from "firebase-admin/auth";
import {
  asList,
  cleanupReason,
  CleanupReason,
  hasTies,
  INACTIVE_DAYS,
  lastActiveMs,
  Ties,
  type CleanupAccount,
} from "./accountCleanupPlan";
import { reportError, withSentry } from "./sentry";

/**
 * Where the daily list is kept for /admin. No client access (rules deny by default): the
 * admin callables read and update it.
 */
export const cleanupListRef = (db: Firestore) => db.collection("admin_cleanup").doc("latest");

/** At most this many are stored (a Firestore doc tops out at 1 MiB); `total` keeps the count. */
export const MAX_LISTED = 500;

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
  keep: u.customClaims?.keep === true,
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
  let sharedLogs = ledgers.docs.filter((d) => asList(d.get("memberUids")).length > 1).length;

  const userDocs = (await db.collection("users").where("userId", "==", uid).get()).docs;
  const groupIds = new Set<string>();
  for (const doc of userDocs) {
    for (const id of asList(doc.get("groups"))) {
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
    sharedLogs += groups.filter((g) => g.exists && asList(g.get("members")).length > 1).length;
  }
  return { friendships, sharedLogs };
};

/** Whether this account is up for cleanup now, re-read fresh: null to keep it. */
export const candidateFor = async (
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
      try {
        const candidate = await candidateFor(db, user, nowMs);
        if (candidate) found.push(candidate);
      } catch (error) {
        // One account that can't be checked is left off the list, not the whole scan.
        reportError(error, { action: "cleanup_scan_account", level: "warning" });
      }
    }
    pageToken = page.pageToken;
  } while (pageToken);
  return found.sort((a, b) => (a.lastActiveAt ?? "").localeCompare(b.lastActiveAt ?? ""));
};

/** Scan every account now and store the list /admin shows. */
export const refreshCleanupList = async (db: Firestore) => {
  const candidates = await findCleanupCandidates(db);
  const list = {
    candidates: candidates.slice(0, MAX_LISTED),
    total: candidates.length,
    inactiveDays: INACTIVE_DAYS,
    listedAt: new Date().toISOString(),
  };
  await cleanupListRef(db).set({ ...list, updatedAt: FieldValue.serverTimestamp() });
  return list;
};

/**
 * Daily: list idle guests and idle, unconnected unconfirmed accounts (see
 * accountCleanupPlan.ts) for /admin → account cleanup. It never deletes anything: an
 * admin deletes each listed account by hand (adminCleanupDelete), which checks it again.
 */
export const listCleanupCandidates = onSchedule(
  {
    schedule: "every day 04:00",
    timeZone: "America/Vancouver",
    timeoutSeconds: 540,
    memory: "512MiB",
  },
  withSentry("listCleanupCandidates", async () => {
    const list = await refreshCleanupList(getFirestore());
    const counts = list.candidates.reduce<Record<string, number>>(
      (acc, c) => ({ ...acc, [c.reason]: (acc[c.reason] ?? 0) + 1 }),
      {},
    );
    console.log(`listCleanupCandidates: ${list.total} listed (${JSON.stringify(counts)})`);
  }),
);
