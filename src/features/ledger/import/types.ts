import { Currency } from "@/types/user";

/** Which app a file (or, later, a sync) came from. Stored on imported entries. */
export type ImportSource = "moneyforward" | "ynab";

/**
 * One spending row read from another app, normalised but not yet mapped to a ledger.
 * Only outflows survive parsing: ledger entries are always positive spending.
 */
export type ImportRow = {
  /**
   * Stable id for the row in its source app, so re-importing the same row is a no-op.
   * The backend hashes it (with the importer's uid) into the entry's doc id.
   */
  externalId: string;
  date: string; // YYYY-MM-DD
  amount: number; // > 0
  currency: Currency;
  /** The source app's category label; mapped to a ledger category before import. */
  sourceCategory: string;
  note?: string;
};

/** Why rows were left out, so the preview can say "skipped 12 transfers". */
export type SkipReason = "transfer" | "income" | "excluded" | "invalid";

export type ParseResult = {
  rows: ImportRow[];
  skipped: Record<SkipReason, number>;
};

export const emptySkipped = (): Record<SkipReason, number> => ({
  transfer: 0,
  income: 0,
  excluded: 0,
  invalid: 0,
});
