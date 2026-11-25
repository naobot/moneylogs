import { storage } from "@/platform";
import type { WizardState } from "./wizardSteps";

/**
 * Keeps a guest's half-made log across the reload that saving their account does
 * (SaveGuestAccount), so the create wizard comes back where they left it instead of at
 * its first step. Only written when a guest opens "save account" from the wizard; read
 * once when the wizard opens again; gone after an hour, or once the log is created.
 */
export const CREATE_LOG_DRAFT_KEY = "ML__create_log_draft";
export const CREATE_LOG_DRAFT_MAX_AGE_MS = 60 * 60 * 1000;

type Stored = { uid: string; savedAt: number; state: WizardState };

export const keepCreateLogDraft = (uid: string, state: WizardState, now = Date.now()) =>
  storage.set(CREATE_LOG_DRAFT_KEY, JSON.stringify({ uid, savedAt: now, state }));

export const dropCreateLogDraft = () => storage.remove(CREATE_LOG_DRAFT_KEY);

const looksLikeState = (s: unknown): s is WizardState => {
  const v = s as Partial<WizardState> | null;
  return (
    !!v &&
    typeof v === "object" &&
    (v.mode === null || v.mode === "social" || v.mode === "financial") &&
    typeof v.title === "string" &&
    Array.isArray(v.inviteFriendIds)
  );
};

/**
 * The kept draft and whose it is, if it's recent and well-formed. Doesn't remove it: the
 * wizard drops it once mounted (a StrictMode double render must see it twice), and checks
 * the uid once the account has loaded.
 */
export const peekCreateLogDraft = (
  now = Date.now(),
): { uid: string; state: WizardState } | null => {
  const raw = storage.get(CREATE_LOG_DRAFT_KEY);
  if (!raw) return null;
  try {
    const stored = JSON.parse(raw) as Partial<Stored>;
    if (
      typeof stored.uid !== "string" ||
      typeof stored.savedAt !== "number" ||
      now - stored.savedAt > CREATE_LOG_DRAFT_MAX_AGE_MS ||
      !looksLikeState(stored.state)
    ) {
      return null;
    }
    return { uid: stored.uid, state: stored.state };
  } catch {
    return null;
  }
};
