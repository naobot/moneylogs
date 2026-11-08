/**
 * Pure monthly aggregation for financial-mode ledgers.
 *
 * Shared by the `recomputeLedgerMonth` Cloud Function (which stores the result in
 * ledgers/{id}/months/{YYYY-MM}) and the web app (which computes the viewed month live from
 * its loaded entries). Keep this file dependency-free so both builds can import it.
 */

export type Amounts = { [currency: string]: number };

export type AggregatableEntry = {
  amount: number;
  currency: string;
  categoryId: string;
  authorUid: string;
  date: string; // YYYY-MM-DD
};

export type MonthAggregate = {
  entryCount: number;
  totals: Amounts;
  byCategory: { [categoryId: string]: Amounts };
  byMember: { [uid: string]: Amounts };
  byDay: { [day: string]: Amounts }; // "DD"
};

const round2 = (n: number) => Math.round(n * 100) / 100;

const add = (bucket: Amounts, currency: string, amount: number) => {
  bucket[currency] = round2((bucket[currency] || 0) + amount);
};

const isValid = (e: Partial<AggregatableEntry>): e is AggregatableEntry =>
  typeof e.amount === "number" &&
  isFinite(e.amount) &&
  e.amount > 0 &&
  typeof e.currency === "string" &&
  typeof e.categoryId === "string" &&
  typeof e.authorUid === "string" &&
  typeof e.date === "string" &&
  /^\d{4}-\d{2}-\d{2}$/.test(e.date);

export const aggregateMonth = (
  entries: ReadonlyArray<Partial<AggregatableEntry>>,
): MonthAggregate => {
  const result: MonthAggregate = {
    entryCount: 0,
    totals: {},
    byCategory: {},
    byMember: {},
    byDay: {},
  };
  for (const entry of entries) {
    if (!isValid(entry)) continue;
    const { amount, currency, categoryId, authorUid, date } = entry;
    result.entryCount++;
    add(result.totals, currency, amount);
    add((result.byCategory[categoryId] = result.byCategory[categoryId] || {}), currency, amount);
    add((result.byMember[authorUid] = result.byMember[authorUid] || {}), currency, amount);
    const day = date.slice(8, 10);
    add((result.byDay[day] = result.byDay[day] || {}), currency, amount);
  }
  return result;
};

/** Fields whose change affects the aggregate. A note-only edit needs no recompute. */
export const aggregateFieldsChanged = (
  before: Partial<AggregatableEntry> | undefined,
  after: Partial<AggregatableEntry> | undefined,
): boolean => {
  if (!before || !after) return true;
  return (
    before.amount !== after.amount ||
    before.currency !== after.currency ||
    before.categoryId !== after.categoryId ||
    before.authorUid !== after.authorUid ||
    before.date !== after.date
  );
};

const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

/** The month documents an entry write touches (an edit can move an entry between months). */
export const affectedMonths = (
  before: { month?: unknown } | undefined,
  after: { month?: unknown } | undefined,
): string[] => {
  const months = new Set<string>();
  for (const m of [before?.month, after?.month]) {
    if (typeof m === "string" && MONTH_RE.test(m)) months.add(m);
  }
  return [...months];
};
