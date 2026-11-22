/**
 * Sublogs on the parent's side: a category that is another log rolled up (see
 * functions/src/ledgerRollup.ts). Its amounts come from rollups/ docs, never from entries
 * in this log, so the parent's live month is its entries merged with those docs.
 */
import { Currency } from "@/types/user";
import { CurrencyAmounts, Ledger, LedgerCategory, LedgerEntry, LedgerRollup } from "@/types/ledger";
import { CURRENCIES } from "@/utils/currency";
import { formatDate } from "@/utils/dateFormat";
import dayjs from "@/utils/configuredDayjs";
import { EntryDay } from "@/utils/ledgerEntries";
import { ledgerViewPath } from "@/utils/ledger";
import { MonthAggregate } from "@/utils/ledgerStats";
import { aggregateMonth } from "../../functions/src/ledgerAggregate";
import { isActiveSublog, MergedMonth, mergeRollups } from "../../functions/src/ledgerRollup";

export { isActiveSublog };

/**
 * Linked categories that are live now: category id → its link id. The line never names
 * the sublog's ledger; see sublogsInMyLogs for finding it.
 */
export const activeSublogs = (categories: ReadonlyArray<LedgerCategory>): Map<string, string> =>
  new Map(
    categories.filter((c) => !c.archived && isActiveSublog(c)).map((c) => [c.id, c.sublog!.linkId]),
  );

/**
 * Each live linked category's sublog, among the viewer's own logs: category id → the
 * sublog's id, or null when the viewer isn't in it (so it can't be opened, or named).
 */
export const sublogsInMyLogs = (
  categories: ReadonlyArray<LedgerCategory>,
  myLedgers: ReadonlyArray<Pick<Ledger, "id" | "parentLink">>,
): Map<string, string | null> => {
  const byLink = new Map(
    myLedgers.flatMap((l) => (l.parentLink ? [[l.parentLink.linkId, l.id] as const] : [])),
  );
  return new Map(
    [...activeSublogs(categories)].map(([categoryId, linkId]) => [
      categoryId,
      byLink.get(linkId) ?? null,
    ]),
  );
};

/** Whether this log has (or had) sublogs, so it may have roll-ups to load. */
export const hasRollups = (ledger: Pick<Ledger, "hasRollups" | "categories">): boolean =>
  ledger.hasRollups === true || (ledger.categories ?? []).some((c) => !!c.sublog);

/** Linked category id → the path into its sublog (null: the viewer isn't a member). */
export type SublogPaths = ReadonlyMap<string, string | null>;

/** Sublog links that open the sublog on the same month. */
export const sublogPaths = (
  links: ReadonlyMap<string, string | null>,
  month: string,
  currentMonth: string,
): SublogPaths =>
  new Map(
    [...links].map(([categoryId, childId]) => [
      categoryId,
      childId ? ledgerViewPath(childId, "entries", month, currentMonth) : null,
    ]),
  );

/** Categories an entry can be filed under here: linked ones are logged in their sublog. */
export const entryCategories = (categories: ReadonlyArray<LedgerCategory>): LedgerCategory[] =>
  categories.filter((c) => !isActiveSublog(c));

/** The viewed month exactly as the backend builds it: entries plus roll-ups. */
export const mergeMonth = (
  entries: ReadonlyArray<LedgerEntry>,
  rollups: ReadonlyArray<LedgerRollup>,
): MergedMonth => mergeRollups(aggregateMonth(entries), rollups);

/** Anything at all in the month, whether logged here or rolled up from a sublog. */
export const hasSpending = (agg: MonthAggregate & { rolledUp?: Record<string, number> }) =>
  agg.entryCount > 0 || Object.keys(agg.rolledUp ?? {}).length > 0;

/** Currencies by number of entries (here and in sublogs), ties in picker order. */
export const currenciesInMonth = (
  entries: ReadonlyArray<Pick<LedgerEntry, "currency">>,
  rollups: ReadonlyArray<Pick<LedgerRollup, "totals" | "entryCount">>,
): Currency[] => {
  const counts = new Map<Currency, number>();
  const bump = (c: Currency, n: number) => counts.set(c, (counts.get(c) ?? 0) + n);
  for (const { currency } of entries) bump(currency, 1);
  // A roll-up only knows its total entries, so each of its currencies gets a share.
  for (const r of rollups) {
    const used = CURRENCIES.filter((c) => (r.totals?.[c] ?? 0) > 0);
    for (const c of used) bump(c, r.entryCount / used.length);
  }
  return CURRENCIES.filter((c) => counts.has(c)).sort(
    (a, b) => (counts.get(b) ?? 0) - (counts.get(a) ?? 0),
  );
};

/** Authors' names from entries and roll-ups, for "by person". */
export const memberNames = (
  entries: ReadonlyArray<Pick<LedgerEntry, "authorUid" | "authorName">>,
  rollups: ReadonlyArray<Pick<LedgerRollup, "names">>,
): Record<string, string> => {
  const names: Record<string, string> = {};
  for (const r of rollups) Object.assign(names, r.names);
  for (const e of entries) names[e.authorUid] = e.authorName;
  return names;
};

/** One sublog's spending on one day, as the parent's entry list shows it. */
export type SublogDayRow = {
  categoryId: string;
  name: string;
  amounts: CurrencyAmounts;
  count: number;
};

export type DayWithSublogs<T> = EntryDay<T> & { sublogs: SublogDayRow[] };

/**
 * The entry list's days with each sublog's day total added: a row per sublog per day,
 * after that day's own entries, counted in the day's subtotal. Days that only have
 * sublog spending get their own header. Newest day first, like groupEntriesByDay.
 */
export const withSublogDays = <T>(
  days: ReadonlyArray<EntryDay<T>>,
  rollups: ReadonlyArray<LedgerRollup>,
  categories: ReadonlyArray<LedgerCategory>,
): DayWithSublogs<T>[] => {
  const byDate = new Map<string, DayWithSublogs<T>>(
    days.map((d) => [d.date, { ...d, subtotals: { ...d.subtotals }, sublogs: [] }]),
  );
  for (const r of rollups) {
    const category = categories.find((c) => c.id === r.categoryId);
    for (const [dd, amounts] of Object.entries(r.byDay ?? {})) {
      const date = `${r.month}-${dd}`;
      let day = byDate.get(date);
      if (!day) {
        day = {
          date,
          label: formatDate(dayjs(date), { year: false }),
          entries: [],
          subtotals: {},
          sublogs: [],
        };
        byDate.set(date, day);
      }
      day.sublogs.push({
        categoryId: r.categoryId,
        name: category?.name ?? "sublog",
        amounts,
        count: r.countByDay?.[dd] ?? 0,
      });
      for (const [currency, amount] of Object.entries(amounts)) {
        const c = currency as Currency;
        day.subtotals[c] = Math.round(((day.subtotals[c] ?? 0) + (amount ?? 0)) * 100) / 100;
      }
    }
  }
  const order = new Map(categories.map((c) => [c.id, c.order]));
  for (const day of byDate.values()) {
    day.sublogs.sort((a, b) => (order.get(a.categoryId) ?? 0) - (order.get(b.categoryId) ?? 0));
  }
  return [...byDate.values()].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
};
