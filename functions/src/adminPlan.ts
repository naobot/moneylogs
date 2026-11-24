/**
 * Pure helpers for the admin callables (admin.ts). Dependency-free so they can be unit
 * tested from the root Vitest run.
 *
 * Admins are accounts with the `admin` custom claim (scripts/set-admin.ts). Every admin
 * action runs the same server code the app uses for the person themselves, so deleting
 * from the panel leaves no more (and no fewer) references than deleting in the app.
 */
import { parseDeleteLogRequest, type DeleteLogRequest, type LogKind } from "./deleteLogPlan";
import { planLedgerExit, planSocialExit } from "./deleteAccountPlan";
import { spiritGiftBlock } from "./giftsPlan";

/** Whether a decoded ID token carries the admin claim. */
export const isAdminToken = (token: unknown): boolean =>
  !!token && typeof token === "object" && (token as { admin?: unknown }).admin === true;

export type AdminGiftMode = "grant" | "spirit";
export type AdminGiftRequest = {
  userDocId: string;
  item: string;
  count: number;
  mode: AdminGiftMode;
};

/** The most copies one request may add: spirit gifts are a gesture, grants a top-up. */
export const MAX_GIFT_COUNT: Record<AdminGiftMode, number> = { spirit: 20, grant: 200 };

const ID_RE = /^[A-Za-z0-9_-]{1,128}$/;
const ITEM_RE = /^[a-z0-9_]{1,64}$/;

export const parseAdminGiftRequest = (data: unknown): AdminGiftRequest | null => {
  if (!data || typeof data !== "object") return null;
  const { userDocId, item, count, mode } = data as Record<string, unknown>;
  if (mode !== "grant" && mode !== "spirit") return null;
  if (typeof userDocId !== "string" || !ID_RE.test(userDocId)) return null;
  if (typeof item !== "string" || !ITEM_RE.test(item)) return null;
  if (typeof count !== "number" || !Number.isInteger(count)) return null;
  if (count < 1 || count > MAX_GIFT_COUNT[mode]) return null;
  return { userDocId, item, count, mode };
};

/**
 * Why an item can't be added to someone's knick-knacks by hand, or null if it can.
 * Milestones are earned, never given, whichever way they'd arrive.
 */
export const grantBlock = spiritGiftBlock;

export const parseAdminDeleteLogRequest = (data: unknown): DeleteLogRequest | null =>
  parseDeleteLogRequest(data);

export type AdminDeleteAccountRequest = { uid: string; confirm: string };

export const parseAdminDeleteAccountRequest = (data: unknown): AdminDeleteAccountRequest | null => {
  if (!data || typeof data !== "object") return null;
  const { uid, confirm } = data as Record<string, unknown>;
  if (typeof uid !== "string" || !ID_RE.test(uid)) return null;
  if (typeof confirm !== "string" || !confirm) return null;
  return { uid, confirm };
};

/**
 * What the admin types to confirm an account deletion: the sign-in email, or the uid
 * when the account has none. Case-insensitive, whitespace-trimmed.
 */
export const accountConfirmPhrase = (account: { uid: string; email?: string | null }) =>
  (account.email || account.uid).trim().toLowerCase();

export const confirmsAccount = (
  typed: string,
  account: { uid: string; email?: string | null },
): boolean => typed.trim().toLowerCase() === accountConfirmPhrase(account);

export type LogSummaryInput = {
  kind: LogKind;
  id: string;
  title: string;
  data: {
    members?: ReadonlyArray<{ id?: unknown } | null | undefined>;
    memberUids?: ReadonlyArray<unknown>;
    createdBy?: unknown;
  };
};

/**
 * Whether a social log is the person's: they're in its members, or they created it.
 * A user doc's `groups` list is theirs to write, so a log found only through it (a join
 * refused for lack of room, before joins were one transaction) isn't shown as theirs.
 */
export const isInSocialLog = (
  data: LogSummaryInput["data"],
  uid: string,
  userDocIds: ReadonlySet<string>,
): boolean =>
  data.createdBy === uid ||
  (data.members ?? []).some((ref) => typeof ref?.id === "string" && userDocIds.has(ref.id));

export type AccountDeletionPreview = {
  /** Logs only this person is in: deleted with everything in them. */
  purge: { kind: LogKind; id: string; title: string }[];
  /** Shared logs: stay for the others, with this person's content anonymised. */
  leave: { kind: LogKind; id: string; title: string; others: number }[];
};

/** Dry run of deleteAccount's per-log decisions (deleteAccountPlan.ts). */
export const previewAccountDeletion = (
  logs: ReadonlyArray<LogSummaryInput>,
  uid: string,
  userDocIds: ReadonlySet<string>,
): AccountDeletionPreview => {
  const preview: AccountDeletionPreview = { purge: [], leave: [] };
  for (const { kind, id, title, data } of logs) {
    if (kind === "social") {
      const plan = planSocialExit(data, uid, userDocIds);
      if (plan.action === "purge") preview.purge.push({ kind, id, title });
      else if (plan.action === "leave") {
        preview.leave.push({ kind, id, title, others: plan.remainingMemberIds.length });
      }
    } else {
      const plan = planLedgerExit(data, uid, userDocIds);
      if (plan.action === "purge") preview.purge.push({ kind, id, title });
      else if (plan.action === "leave") {
        preview.leave.push({ kind, id, title, others: plan.memberUids.length });
      }
    }
  }
  return preview;
};
