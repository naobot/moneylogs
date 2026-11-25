import { httpsCallable } from "firebase/functions";
import { FirebaseError } from "firebase/app";
import { functions } from "@/config/firebase-config";
import type { KnickKnackId } from "@/features/ledger/buddy/knickknacks/catalog";

/** Client side of functions/src/admin.ts. Every callable checks the `admin` claim. */

export type AdminLogKind = "social" | "financial";

export type AdminLog = {
  kind: AdminLogKind;
  id: string;
  title: string;
  members: number;
  isCreator: boolean;
  archived: boolean;
};

export type AdminLogRef = { kind: AdminLogKind; id: string; title: string };

export type AdminUser = {
  uid: string;
  email: string | null;
  /** Trying the app without an account: no email or password yet. */
  guest: boolean;
  emailVerified: boolean;
  authExists: boolean;
  displayName: string | null;
  createdAt: string | null;
  lastSignInAt: string | null;
  userDocIds: string[];
  knickknacks: Record<string, number>;
  logs: AdminLog[];
  preview: {
    purge: AdminLogRef[];
    leave: (AdminLogRef & { others: number })[];
  };
};

export type AdminGiftMode = "grant" | "spirit";

export const adminLookupUser = httpsCallable<{ query: string }, AdminUser>(
  functions,
  "adminLookupUser",
);

export const adminGift = httpsCallable<
  { userDocId: string; item: KnickKnackId; count: number; mode: AdminGiftMode },
  { ok: boolean; notified: boolean }
>(functions, "adminGift");

export const adminDeleteLog = httpsCallable<
  { kind: AdminLogKind; id: string },
  { deleted: boolean; posts: number; participants: number }
>(functions, "adminDeleteLog");

export const adminDeleteAccount = httpsCallable<
  { uid: string; confirm: string },
  { deleted: boolean; logsDeleted: number; logsLeft: number }
>(functions, "adminDeleteAccount");

export type CleanupCandidate = {
  uid: string;
  reason: "idle_guest" | "idle_unconfirmed";
  email: string | null;
  createdAt: string | null;
  lastActiveAt: string | null;
  /** A deletion stopped partway (logs may be gone; the account is disabled): delete again. */
  unfinished?: boolean;
};

export type CleanupList = {
  candidates: CleanupCandidate[];
  /** How many were found; more than `candidates` when the stored list was capped. */
  total: number;
  inactiveDays: number;
  /** When the list was built (ISO), or null before the first daily run. */
  listedAt: string | null;
};

/**
 * The account cleanup list (functions/src/accountCleanup.ts), built daily. `refresh`
 * builds it again now. Listing never deletes anything.
 */
export const adminCleanupList = httpsCallable<{ refresh?: boolean }, CleanupList>(
  functions,
  "adminCleanupList",
  // A refresh scans every account: wait as long as the function may run (300 s), not the
  // SDK's default 70 s.
  { timeout: 300_000 },
);

/**
 * Delete one listed account. The server checks it again first: `kept` means they came
 * back or made ties since, `gone` that the account no longer exists. Either way it's
 * taken off the list.
 */
export const adminCleanupDelete = httpsCallable<
  { uid: string },
  { deleted: boolean; reason: "idle_guest" | "idle_unconfirmed" | "kept" | "gone" }
>(functions, "adminCleanupDelete", { timeout: 540_000 });

/** The server's own message for an HttpsError, else a generic one. */
export const adminErrorMessage = (err: unknown): string =>
  err instanceof FirebaseError && err.message && !err.code.endsWith("/internal")
    ? err.message
    : "Something went wrong. Check Sentry; it's safe to try again.";

/** Codes that are the admin's input, not a bug worth reporting. */
export const isExpectedAdminError = (err: unknown): boolean =>
  err instanceof FirebaseError &&
  ["not-found", "invalid-argument", "failed-precondition", "permission-denied"].includes(
    err.code.replace("functions/", ""),
  );
