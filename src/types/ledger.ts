import { DocumentReference, Timestamp } from "firebase/firestore";
import { Currency } from "./user";
import type { ScheduleRepeat } from "../../functions/src/schedulePlan";

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
  /** A fixed cost (rent, bills); unset falls back to the defaults. See isFixedCategory. */
  fixed?: boolean;
  budget?: CurrencyAmounts; // reserved for budgets (monthly, per currency)
  /**
   * This category is another ledger (a sublog) rolled up: its amounts come from
   * rollups/, never from entries here. Set and ended only by the link/unlink functions;
   * category edits must carry it through. With `unlinkedAt`, past months only. It names
   * the link, never the sublog's ledger: members of both logs find the sublog by
   * matching `linkId` against their own logs' parentLink (src/utils/sublogs.ts).
   */
  sublog?: { linkId: string; linkedAt?: Timestamp; unlinkedAt?: Timestamp };
};

// ledgers/{ledgerId}
export type Ledger = {
  id: string;
  title: string;
  max_participants: number;
  members: Array<DocumentReference>; // user doc refs (matches log_groups for reuse)
  memberUids: Array<string>; // auth uids — used by security rules and list queries
  categories: Array<LedgerCategory>;
  /**
   * The month's total budget per currency: expected income, or a cap on spending. When
   * set, all spending counts against it and category budgets are carved out of it (see
   * budgetLines in functions/src/ledgerBudget.ts). Unset: the category budgets' sum.
   */
  monthlyBudget?: CurrencyAmounts;
  defaultCurrency: Currency;
  createdAt: Timestamp;
  /** Auth uid of the creator. Older ledgers lack it; memberUids[0] is the creator there. */
  createdBy?: string;
  /** Set by the deleteLog function while the ledger is being removed. */
  deleting?: boolean;
  /**
   * This ledger is a sublog: from `since` ("YYYY-MM") on, entries by people who are also
   * in the parent count as the parent's `categoryId`. Written only by Cloud Functions.
   * No parent id: members who aren't in the parent mustn't learn it (an id is enough to
   * join a ledger with room). Members of both find it by matching `linkId`.
   */
  parentLink?: {
    linkId: string;
    categoryId: string;
    since: string;
    linkedBy: string;
    linkedAt?: Timestamp;
  };
  /** Has (or had) sublogs, so its months take in rollups/. Written only by functions. */
  hasRollups?: boolean;
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
  /** Set on entries brought in by importLedgerEntries (MoneyForward / YNAB). */
  importSource?: "moneyforward" | "ynab";
  importBatchId?: string;
  /** Set on entries a scheduled payment logged (functions/src/scheduledEntries.ts). */
  scheduleId?: string;
};

/**
 * ledgers/{ledgerId}/schedules/{scheduleId}: a scheduled payment on a fixed category,
 * logged as an entry by its owner on each due day (functions/src/schedulePlan.ts).
 */
export type LedgerSchedule = {
  id: string;
  categoryId: string;
  /** Becomes each entry's note. */
  label: string;
  amount: number;
  currency: Currency;
  repeat: ScheduleRepeat;
  /** Who set it up: the author of its entries, and the only one who can change it. */
  ownerUid: string;
  ownerDocId: string;
  paused?: boolean;
  /** "YYYY-MM-DD" in the owner's zone. Server-written; absent while paused or booking. */
  nextDue?: string;
  /** "YYYY-MM-DD", the last day it logged. Server-written. */
  lastLogged?: string;
};

// ledgers/{ledgerId}/months/{YYYY-MM} — derived, backend-written summary
export type LedgerMonth = {
  month: string;
  entryCount: number;
  totals: CurrencyAmounts;
  byCategory: Record<string, CurrencyAmounts>;
  byMember: Record<string, CurrencyAmounts>;
  byDay: Record<string, CurrencyAmounts>; // keyed "DD"
  /** Entries that came in from sublogs, per linked category; not in entryCount. */
  rolledUp?: Record<string, number>;
  computedAt: Timestamp;
};

// ledgers/{parentId}/rollups/{YYYY-MM}__{linkId} — derived, backend-written
export type LedgerRollup = Omit<LedgerMonth, "rolledUp"> & {
  linkId: string;
  categoryId: string;
  countByDay: Record<string, number>; // entries per day, keyed "DD"
  names?: Record<string, string>; // counted authors' display names, by uid
  /** The link has ended: this month keeps its totals and is never rebuilt. */
  frozen?: boolean;
};

// Fields a client supplies when creating or editing an entry.
export type LedgerEntryInput = {
  amount: number;
  currency: Currency;
  categoryId: string;
  date: string;
  note?: string;
};
