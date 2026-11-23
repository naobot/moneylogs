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
export const DRAFT_KEY = "ML__postDraft";

/** Before drafts were tagged: the post's text, stored as-is (even if it looks like JSON). */
export const LEGACY_DRAFT_KEY = "ML__logPostDraft";

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

/** Parse a stored draft record for `uid`; anything else (or anyone else's) is null. */
export const parseDraft = (raw: string | null, uid: string): PostDraft | null => {
  if (!raw) return null;
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof value !== "object" || value === null) return null;
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

/** This account's draft, else an untagged one from before (text only). */
export const readPostDraft = (uid: string): PostDraft | null => {
  const draft = parseDraft(storage.get(DRAFT_KEY), uid);
  if (draft) return draft;
  const legacy = storage.get(LEGACY_DRAFT_KEY);
  return legacy ? { content: legacy } : null;
};

export const writePostDraft = (uid: string, draft: PostDraft): void => {
  // Only drop the old copy once the new one is stored (a full quota can refuse it).
  if (storage.setJSON(DRAFT_KEY, { uid, ...draft } satisfies Stored)) {
    storage.remove(LEGACY_DRAFT_KEY);
  }
};

export const clearPostDraft = (): void => {
  storage.remove(DRAFT_KEY);
  storage.remove(LEGACY_DRAFT_KEY);
};
