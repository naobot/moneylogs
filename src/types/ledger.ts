import { DocumentReference, Timestamp } from "firebase/firestore";
import { Currency } from "./user";

/**
 * Financial-mode ("ledger") types.
 *
 * Ledgers live in their own `ledgers` collection, separate from social `log_groups`,
 * so they can be locked down to members in Firestore rules without affecting
 * social groups (which allow spectators).
 */

export type CurrencyAmounts = Partial<Record<Currency, number>>;

export type LedgerCategory = {
  id: string; // stable id; entries reference this, never the name
  name: string;
  order: number;
  archived?: boolean; // soft delete so historical entries still resolve
  budget?: CurrencyAmounts; // reserved for budgets (monthly, per currency)
};

// ledgers/{ledgerId}
export type Ledger = {
  id: string;
  title: string;
  max_participants: number;
  members: Array<DocumentReference>; // user doc refs (matches log_groups for reuse)
  memberUids: Array<string>; // auth uids — used by security rules and list queries
  categories: Array<LedgerCategory>;
  defaultCurrency: Currency;
  createdAt: Timestamp;
  /** Auth uid of the creator. Older ledgers lack it; memberUids[0] is the creator there. */
  createdBy?: string;
  /** Set by the deleteLog function while the ledger is being removed. */
  deleting?: boolean;
};

// ledgers/{ledgerId}/entries/{entryId}
export type LedgerEntry = {
  id: string;
  amount: number;
  currency: Currency;
  categoryId: string;
  date: string; // "YYYY-MM-DD" — entrant's wall-clock day
  month: string; // "YYYY-MM" — derived from date, used for queries
  note?: string;
  author: DocumentReference;
  authorUid: string;
  authorName: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
};

// ledgers/{ledgerId}/months/{YYYY-MM} — derived, backend-written summary
export type LedgerMonth = {
  month: string;
  entryCount: number;
  totals: CurrencyAmounts;
  byCategory: Record<string, CurrencyAmounts>;
  byMember: Record<string, CurrencyAmounts>;
  byDay: Record<string, CurrencyAmounts>; // keyed "DD"
  computedAt: Timestamp;
};

// Fields a client supplies when creating or editing an entry.
export type LedgerEntryInput = {
  amount: number;
  currency: Currency;
  categoryId: string;
  date: string;
  note?: string;
};
