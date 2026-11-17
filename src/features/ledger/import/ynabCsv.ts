import { Currency } from "@/types/user";
import { headerIndex } from "./csv";
import { DateOrder, detectDateOrder, toIsoDate } from "./dates";
import { ImportFormatError } from "./errors";
import { buildNote, parseAmount, roundAmount } from "./text";
import { ImportRow, ParseResult, emptySkipped } from "./types";

/**
 * YNAB's register export:
 *   Account, Flag, Date, Payee, Category Group/Category, Category Group, Category, Memo,
 *   Outflow, Inflow, Cleared
 * Amounts carry the budget's currency symbol ("$12.34") but no ISO code, and dates follow
 * the user's YNAB date-format setting, so both currency and (sometimes) date order come
 * from the importer. Split transactions are already one row per split.
 */
const COLUMNS = {
  account: "Account",
  date: "Date",
  payee: "Payee",
  memo: "Memo",
  outflow: "Outflow",
} as const;

const CATEGORY_COLUMNS = ["Category Group/Category", "Category"];
const TRANSFER_PREFIX = "Transfer : ";
const UNCATEGORIZED = "Uncategorized";

export const isYnabHeader = (header: ReadonlyArray<string>): boolean => {
  const names = header.map((h) => h.trim());
  return names.includes(COLUMNS.payee) && names.includes(COLUMNS.outflow);
};

export type YnabCsvOptions = {
  currency: Currency;
  /** Needed only when the file's dates are all ambiguous (e.g. 01/02/2024 only). */
  dateOrder?: DateOrder;
};

/**
 * Keep outflows that aren't transfers between the user's own accounts.
 *
 * YNAB register rows have no id, so the external id is the row's content plus an
 * occurrence count for identical rows (two same-day coffees). That stays stable across
 * exports of overlapping date ranges, unlike a position in the file.
 */
export const parseYnabCsv = (
  table: ReadonlyArray<ReadonlyArray<string>>,
  { currency, dateOrder }: YnabCsvOptions,
): ParseResult => {
  const [header, ...body] = table;
  if (!header || body.length === 0) throw new ImportFormatError("empty");

  const index = headerIndex(header);
  const col = Object.fromEntries(
    Object.entries(COLUMNS).map(([key, name]) => [key, index.get(name) ?? -1]),
  ) as Record<keyof typeof COLUMNS, number>;
  const categoryCol = CATEGORY_COLUMNS.map((name) => index.get(name)).find((i) => i !== undefined);
  if (categoryCol === undefined || Object.values(col).some((i) => i < 0)) {
    throw new ImportFormatError("missing-columns");
  }

  const order = dateOrder ?? detectDateOrder(body.map((cells) => cells[col.date] ?? ""));
  if (!order) throw new ImportFormatError("ambiguous-dates");

  const rows: ImportRow[] = [];
  const skipped = emptySkipped();
  const seen = new Map<string, number>();

  for (const cells of body) {
    const cell = (i: number) => (cells[i] ?? "").trim();
    const payee = cell(col.payee);

    if (payee.startsWith(TRANSFER_PREFIX)) {
      skipped.transfer++;
      continue;
    }

    const date = toIsoDate(cell(col.date), order);
    const outflow = parseAmount(cell(col.outflow));
    if (!date || Number.isNaN(outflow)) {
      skipped.invalid++;
      continue;
    }
    if (outflow <= 0) {
      skipped.income++;
      continue;
    }

    const amount = roundAmount(outflow);
    const memo = cell(col.memo);
    const key = [cell(col.account), date, payee, amount, memo].join("|");
    const n = (seen.get(key) ?? 0) + 1;
    seen.set(key, n);

    const note = buildNote(payee, memo);
    rows.push({
      externalId: `ynab-csv:${key}#${n}`,
      date,
      amount,
      currency,
      sourceCategory: cell(categoryCol) || UNCATEGORIZED,
      ...(note ? { note } : {}),
    });
  }

  return { rows, skipped };
};
