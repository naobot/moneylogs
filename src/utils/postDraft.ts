import { Currency } from "@/types/user";
import { isCurrency } from "@/utils/currency";
import { storage } from "@/platform";
import type { AmountRow } from "../../functions/src/postAmounts";

/**
 * The unsent new post, kept on the device so closing the editor doesn't lose it: its
 * text, amount rows and the pull keys of anything pulled in from financial logs (whose
 * amounts are private until posted).
 *
 * Tagged with the author's uid and ignored for anyone else; signing out clears it.
 */
export const DRAFT_KEY = "ML__logPostDraft";

export type PostDraft = {
  content: string;
  rows?: AmountRow<Currency>[];
  pulledIds?: string[];
};

type Stored = PostDraft & { uid: string };

const isRow = (r: unknown): r is AmountRow<Currency> =>
  typeof r === "object" &&
  r !== null &&
  isCurrency((r as AmountRow<Currency>).currency) &&
  Number.isFinite((r as AmountRow<Currency>).amount);

/** Parse what's stored, for `uid`. Drafts from before tagging were text only. */
export const parseDraft = (raw: string | null, uid: string): PostDraft | null => {
  if (!raw) return null;
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return { content: raw };
  }
  if (typeof value !== "object" || value === null) return { content: raw };
  const stored = value as Partial<Stored>;
  if (stored.uid !== uid || typeof stored.content !== "string") return null;
  const rows = Array.isArray(stored.rows) ? stored.rows.filter(isRow) : [];
  const pulledIds = Array.isArray(stored.pulledIds)
    ? stored.pulledIds.filter((id): id is string => typeof id === "string")
    : [];
  return {
    content: stored.content,
    ...(rows.length > 0 ? { rows } : {}),
    ...(pulledIds.length > 0 ? { pulledIds } : {}),
  };
};

export const readPostDraft = (uid: string): PostDraft | null =>
  parseDraft(storage.get(DRAFT_KEY), uid);

export const writePostDraft = (uid: string, draft: PostDraft): void => {
  storage.setJSON(DRAFT_KEY, { uid, ...draft } satisfies Stored);
};

export const clearPostDraft = (): void => storage.remove(DRAFT_KEY);
