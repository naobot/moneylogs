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
