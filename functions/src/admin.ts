import { onCall, HttpsError, CallableRequest } from "firebase-functions/v2/https";
import {
  DocumentData,
  DocumentReference,
  FieldValue,
  Firestore,
  getFirestore,
} from "firebase-admin/firestore";
import { getAuth, UserRecord } from "firebase-admin/auth";
import {
  confirmsAccount,
  grantBlock,
  isAdminToken,
  isInSocialLog,
  LogSummaryInput,
  parseAdminDeleteAccountRequest,
  parseAdminDeleteLogRequest,
  parseAdminGiftRequest,
  previewAccountDeletion,
} from "./adminPlan";
import { deleteUserData } from "./deleteAccount";
import { LogKind, resolveCreator } from "./deleteLogPlan";
import { KNICK_KNACK_FINDS } from "./knickknacks";
import { grantKept, sendSpiritGift } from "./knickknackGrants";
import { purgeLog } from "./purgeLog";
import { reportError, withSentryCall } from "./sentry";
import {
  candidateFor,
  cleanupListRef,
  refreshCleanupList,
  type CleanupCandidate,
} from "./accountCleanup";
import { asList, INACTIVE_DAYS } from "./accountCleanupPlan";

/**
 * Admin-only callables behind the /admin page. Admins carry the `admin` custom claim
 * (scripts/set-admin.ts); every callable checks it before anything else. Deletions run
 * the exact cascades the app uses (purgeLog, deleteUserData), so nothing is left behind
 * that the person's own delete would have removed. Each action is recorded in
 * `admin_actions` (no client access: rules deny by default).
 */

const requireAdmin = (request: CallableRequest): string => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError("unauthenticated", "Sign in first.");
  if (!isAdminToken(request.auth?.token)) {
    throw new HttpsError("permission-denied", "Admins only.");
  }
  return uid;
};

const audit = (
  db: Firestore,
  adminUid: string,
  action: string,
  target: Record<string, unknown>,
  details: Record<string, unknown> = {},
) =>
  db.collection("admin_actions").add({
    action,
    adminUid,
    target,
    details,
    at: FieldValue.serverTimestamp(),
  });

const ID_RE = /^[A-Za-z0-9_-]{1,128}$/;

const authUserOrNull = async (uid: string): Promise<UserRecord | null> => {
  try {
    return await getAuth().getUser(uid);
  } catch (err) {
    if ((err as { code?: string })?.code === "auth/user-not-found") return null;
    throw err;
  }
};

/** Resolve an email, user doc id or auth uid to an auth uid. */
const resolveUid = async (db: Firestore, query: string): Promise<string | null> => {
  if (query.includes("@")) {
    try {
      return (await getAuth().getUserByEmail(query)).uid;
    } catch (err) {
      if ((err as { code?: string })?.code === "auth/user-not-found") return null;
      throw err;
    }
  }
  if (!ID_RE.test(query)) return null;
  const userDoc = await db.collection("users").doc(query).get();
  const docUid = userDoc.get("userId");
  if (userDoc.exists && typeof docUid === "string" && docUid) return docUid;
  const byUid = await db.collection("users").where("userId", "==", query).limit(1).get();
  if (!byUid.empty) return query;
  return (await authUserOrNull(query))?.uid ?? null;
};

const isoOf = (value: unknown): string | null => {
  if (!value) return null;
  if (typeof value === "string") return new Date(value).toISOString();
  const toDate = (value as { toDate?: () => Date }).toDate;
  return typeof toDate === "function" ? toDate.call(value).toISOString() : null;
};

export type AdminLog = {
  kind: LogKind;
  id: string;
  title: string;
  members: number;
  isCreator: boolean;
  archived: boolean;
};

/** Look up an account by email, user doc id or auth uid, with its logs and inventory. */
export const adminLookupUser = onCall(
  withSentryCall("adminLookupUser", async (request) => {
    requireAdmin(request);
    const query = typeof request.data?.query === "string" ? request.data.query.trim() : "";
    if (!query) throw new HttpsError("invalid-argument", "Expected { query }.");

    const db = getFirestore();
    const uid = await resolveUid(db, query);
    if (!uid) throw new HttpsError("not-found", "No account matches that.");

    const authUser = await authUserOrNull(uid);
    const userDocs = (await db.collection("users").where("userId", "==", uid).get()).docs;
    const userRefs: DocumentReference[] = userDocs.map((d) => d.ref);
    const userDocIds = new Set(userRefs.map((r) => r.id));

    // Social logs, found the same way deleteAccount finds them.
    const groupIds = new Set<string>();
    for (const doc of userDocs) {
      for (const id of asList(doc.data().groups)) {
        if (typeof id === "string" && ID_RE.test(id)) groupIds.add(id);
      }
    }
    for (const ref of userRefs) {
      const memberOf = await db
        .collection("log_groups")
        .where("members", "array-contains", ref)
        .get();
      for (const d of memberOf.docs) groupIds.add(d.id);
    }
    const groupSnaps = groupIds.size
      ? await db.getAll(...[...groupIds].map((id) => db.collection("log_groups").doc(id)))
      : [];
    const ledgerSnaps = (
      await db.collection("ledgers").where("memberUids", "array-contains", uid).get()
    ).docs;

    // Archiving is per person: an `archivedLogs.{logId}` marker on their user doc.
    const archivedIds = new Set(
      userDocs.flatMap((d) => Object.keys((d.get("archivedLogs") ?? {}) as object)),
    );
    const inputs: LogSummaryInput[] = [];
    const logs: AdminLog[] = [];
    const add = (kind: LogKind, id: string, data: DocumentData) => {
      const title = typeof data.title === "string" && data.title ? data.title : "(untitled)";
      inputs.push({ kind, id, title, data });
      logs.push({
        kind,
        id,
        title,
        members: ((data.members ?? []) as unknown[]).length,
        isCreator: resolveCreator(kind, data) === uid,
        archived: archivedIds.has(id),
      });
    };
    for (const snap of groupSnaps) {
      if (snap.exists && isInSocialLog(snap.data()!, uid, userDocIds)) {
        add("social", snap.id, snap.data()!);
      }
    }
    for (const snap of ledgerSnaps)
      if (!snap.get("deleting")) add("financial", snap.id, snap.data());

    // Inventory: how many of each knick-knack, across their user docs.
    const knickknacks: Record<string, number> = {};
    for (const ref of userRefs) {
      const finds = await ref.collection("knickknacks").select("item").get();
      for (const f of finds.docs) {
        const item = f.get("item");
        if (typeof item === "string") knickknacks[item] = (knickknacks[item] ?? 0) + 1;
      }
    }

    const first = userDocs[0]?.data();
    return {
      uid,
      email: authUser?.email ?? null,
      // An anonymous sign-in that hasn't saved its account (src/features/auth/guest.ts).
      guest: !!authUser && authUser.providerData.length === 0,
      emailVerified: !!authUser?.emailVerified,
      authExists: !!authUser,
      displayName:
        (typeof first?.displayName === "string" && first.displayName) ||
        authUser?.displayName ||
        null,
      createdAt: authUser?.metadata.creationTime
        ? new Date(authUser.metadata.creationTime).toISOString()
        : isoOf(first?.createdAt),
      lastSignInAt: authUser?.metadata.lastSignInTime
        ? new Date(authUser.metadata.lastSignInTime).toISOString()
        : null,
      userDocIds: [...userDocIds],
      knickknacks,
      logs,
      preview: previewAccountDeletion(inputs, uid, userDocIds),
    };
  }),
);

const GIFT_BLOCK_MESSAGES = {
  unknown: "That isn't a knick-knack.",
  milestone: "Milestone knick-knacks are earned, not given.",
} as const;

/** Add knick-knacks to someone's drawer, kept ("grant") or wrapped from the forest spirit. */
export const adminGift = onCall(
  withSentryCall("adminGift", async (request) => {
    const adminUid = requireAdmin(request);
    const req = parseAdminGiftRequest(request.data);
    if (!req) {
      throw new HttpsError("invalid-argument", "Expected { userDocId, item, count, mode }.");
    }
    const block = grantBlock(req.item, KNICK_KNACK_FINDS);
    if (block) throw new HttpsError("failed-precondition", GIFT_BLOCK_MESSAGES[block]);

    const db = getFirestore();
    const user = await db.collection("users").doc(req.userDocId).get();
    if (!user.exists) throw new HttpsError("not-found", "No such user.");

    let notified = false;
    if (req.mode === "spirit") {
      ({ notified } = await sendSpiritGift(db, user, req.item, req.count));
    } else {
      await grantKept(db, user.ref, req.item, req.count);
    }
    await audit(
      db,
      adminUid,
      req.mode === "spirit" ? "spirit_gift" : "grant",
      { userDocId: req.userDocId },
      { item: req.item, count: req.count, notified },
    );
    return { ok: true, notified };
  }),
);

/** Delete any log with the same cascade as its creator deleting it (purgeLog). */
export const adminDeleteLog = onCall(
  { timeoutSeconds: 300, memory: "512MiB" },
  withSentryCall("adminDeleteLog", async (request) => {
    const adminUid = requireAdmin(request);
    const req = parseAdminDeleteLogRequest(request.data);
    if (!req) throw new HttpsError("invalid-argument", "Expected { kind, id }.");

    const db = getFirestore();
    const snap = await db
      .collection(req.kind === "financial" ? "ledgers" : "log_groups")
      .doc(req.id)
      .get();
    if (!snap.exists) throw new HttpsError("not-found", "That log doesn't exist.");
    const data = snap.data() as DocumentData;

    const { posts, participants } = await purgeLog(db, req.kind, req.id, data);
    await audit(
      db,
      adminUid,
      "delete_log",
      { kind: req.kind, id: req.id },
      { title: data.title ?? null, createdBy: data.createdBy ?? null, posts, participants },
    );
    console.log(`adminDeleteLog: ${req.kind} ${req.id} by ${adminUid}`);
    return { deleted: true, posts, participants };
  }),
);

/** Delete someone's account exactly as they would from /me (deleteUserData). */
export const adminDeleteAccount = onCall(
  { timeoutSeconds: 540, memory: "512MiB" },
  withSentryCall("adminDeleteAccount", async (request) => {
    const adminUid = requireAdmin(request);
    const req = parseAdminDeleteAccountRequest(request.data);
    if (!req) throw new HttpsError("invalid-argument", "Expected { uid, confirm }.");
    if (req.uid === adminUid) {
      throw new HttpsError("failed-precondition", "Delete your own account from /me instead.");
    }

    const authUser = await authUserOrNull(req.uid);
    if (!confirmsAccount(req.confirm, { uid: req.uid, email: authUser?.email })) {
      throw new HttpsError("failed-precondition", "The confirmation doesn't match the account.");
    }

    const db = getFirestore();
    const result = await deleteUserData(db, req.uid);
    await audit(
      db,
      adminUid,
      "delete_account",
      { uid: req.uid },
      { email: authUser?.email ?? null, ...result },
    );
    console.log(
      `adminDeleteAccount: ${req.uid} by ${adminUid}; ${result.logsDeleted} logs deleted, ${result.logsLeft} left`,
    );
    return { deleted: true, ...result };
  }),
);

/** Takes one account off the stored cleanup list (deleted, or no longer up for it). */
const unlist = (db: Firestore, uid: string) =>
  db.runTransaction(async (tx) => {
    const snap = await tx.get(cleanupListRef(db));
    if (!snap.exists) return;
    const candidates = (snap.get("candidates") ?? []) as CleanupCandidate[];
    const kept = candidates.filter((c) => c.uid !== uid);
    if (kept.length === candidates.length) return;
    tx.update(cleanupListRef(db), {
      candidates: kept,
      total: Math.max(0, ((snap.get("total") as number | undefined) ?? kept.length + 1) - 1),
    });
  });

/**
 * The account cleanup list (accountCleanup.ts): built every day, or now with
 * `{ refresh: true }`. Listing never deletes; adminCleanupDelete does, one at a time.
 */
export const adminCleanupList = onCall(
  { timeoutSeconds: 300, memory: "512MiB" },
  withSentryCall("adminCleanupList", async (request) => {
    requireAdmin(request);
    const db = getFirestore();
    const refresh = (request.data as { refresh?: unknown } | null)?.refresh === true;
    if (refresh) return await refreshCleanupList(db);
    const snap = await cleanupListRef(db).get();
    if (!snap.exists) {
      return { candidates: [], total: 0, inactiveDays: INACTIVE_DAYS, listedAt: null };
    }
    return {
      candidates: (snap.get("candidates") ?? []) as CleanupCandidate[],
      total: (snap.get("total") as number | undefined) ?? 0,
      inactiveDays: (snap.get("inactiveDays") as number | undefined) ?? INACTIVE_DAYS,
      listedAt: (snap.get("listedAt") as string | undefined) ?? null,
    };
  }),
);

/**
 * Delete one listed account, by hand. It's checked again first against a fresh auth
 * record and its ties: someone who came back or made a friend since the list was built
 * is kept (and taken off the list) instead.
 *
 * Then the account is disabled and checked once more, so a sign-in or token refresh that
 * raced the first check is seen, and none can happen while its data is deleted. Its
 * sessions aren't revoked: a kept guest has no other way back in, and an idle account
 * holds no live ID token anyway (tokens last an hour, and minting one counts as activity).
 * If they did come back, or anything fails before the Auth account is gone, it's enabled
 * again, so a failure never leaves someone locked out; the row stays to try again.
 */
export const adminCleanupDelete = onCall(
  { timeoutSeconds: 540, memory: "512MiB" },
  withSentryCall("adminCleanupDelete", async (request) => {
    const adminUid = requireAdmin(request);
    const uid = (request.data as { uid?: unknown } | null)?.uid;
    if (typeof uid !== "string" || !ID_RE.test(uid)) {
      throw new HttpsError("invalid-argument", "Expected { uid }.");
    }
    if (uid === adminUid) {
      throw new HttpsError("failed-precondition", "Delete your own account from /me instead.");
    }

    const db = getFirestore();
    const authUser = await authUserOrNull(uid);
    if (!authUser) {
      await unlist(db, uid);
      return { deleted: false, reason: "gone" as const };
    }
    if (!(await candidateFor(db, authUser, Date.now()))) {
      await unlist(db, uid);
      return { deleted: false, reason: "kept" as const };
    }

    const auth = getAuth();
    // Unlock, unless an admin had disabled the account before this.
    const unlock = async () => {
      if (!authUser.disabled) await auth.updateUser(uid, { disabled: false });
    };
    await auth.updateUser(uid, { disabled: true });
    let outcome: {
      candidate: CleanupCandidate;
      result: Awaited<ReturnType<typeof deleteUserData>>;
    } | null;
    try {
      const candidate = await candidateFor(db, await auth.getUser(uid), Date.now());
      outcome = candidate ? { candidate, result: await deleteUserData(db, uid) } : null;
    } catch (error) {
      // deleteUserData removes the Auth account last, so it still exists here.
      await unlock().catch((unlockError) =>
        reportError(unlockError, { action: "cleanup_unlock", level: "error" }),
      );
      throw error;
    }
    if (!outcome) {
      // Back since the first check.
      await unlock();
      await unlist(db, uid);
      return { deleted: false, reason: "kept" as const };
    }
    const { candidate, result } = outcome;
    await audit(
      db,
      adminUid,
      "cleanup_account",
      { uid },
      {
        reason: candidate.reason,
        email: candidate.email,
        lastActiveAt: candidate.lastActiveAt,
        ...result,
      },
    );
    await unlist(db, uid);
    console.log(`adminCleanupDelete: ${uid} (${candidate.reason}) by ${adminUid}`);
    return { deleted: true, reason: candidate.reason, ...result };
  }),
);
