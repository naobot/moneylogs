import { Currency } from "@/types/user";
import { isCurrency, LAST_CURRENCY_KEY } from "@/utils/currency";

/**
 * Every user starts with a solo financial log called "personal", so the financial side of
 * the app is there from day one rather than hidden behind the create wizard.
 *
 * The ledger id is derived from the auth uid, so two tabs (or a retried write) can never
 * create two of them. The user doc's `personalLedgerId` records that it has been made;
 * once set it is never acted on again, so a user who deletes their personal log keeps it
 * deleted.
 */
export const PERSONAL_LEDGER_TITLE = "personal";
export const PERSONAL_LEDGER_MAX_PARTICIPANTS = 1;
export const PERSONAL_LEDGER_FALLBACK_CURRENCY: Currency = "JPY";

export const personalLedgerId = (uid: string): string => `personal-${uid}`;

/** True once the user doc records that their personal ledger has been created. */
export const hasPersonalLedger = (user: { personalLedgerId?: string } | undefined): boolean =>
  !!user?.personalLedgerId;

export type PersonalLedgerPlan = {
  /** Write the ledger doc (it doesn't exist yet). */
  createLedger: boolean;
  /** Stamp `personalLedgerId` on the user doc. */
  markUser: boolean;
};

/**
 * What the ensure transaction should write, given what it read. Pure so it's testable
 * without Firestore.
 */
export const planPersonalLedger = ({
  userMarked,
  ledgerExists,
}: {
  userMarked: boolean;
  ledgerExists: boolean;
}): PersonalLedgerPlan =>
  userMarked
    ? { createLedger: false, markUser: false }
    : { createLedger: !ledgerExists, markUser: true };

/** The currency the user last picked anywhere in the app, else the app default. */
export const preferredCurrency = (): Currency => {
  try {
    const last = localStorage.getItem(LAST_CURRENCY_KEY);
    return isCurrency(last) ? last : PERSONAL_LEDGER_FALLBACK_CURRENCY;
  } catch {
    return PERSONAL_LEDGER_FALLBACK_CURRENCY;
  }
};
