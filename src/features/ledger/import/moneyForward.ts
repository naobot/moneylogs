import { headerIndex } from "./csv";
import { toIsoDate } from "./dates";
import { ImportFormatError } from "./errors";
import { buildNote, parseAmount, roundAmount } from "./text";
import { ImportRow, ParseResult, emptySkipped } from "./types";

/**
 * MoneyForward ME's household-data CSV ("入出金明細" download):
 *   計算対象, 日付, 内容, 金額（円）, 保有金融機関, 大項目, 中項目, メモ, 振替, ID
 * Dates are YYYY/MM/DD, amounts are yen with spending negative, and the file is usually
 * Shift-JIS (see decodeBytes).
 */
const COLUMNS = {
  included: "計算対象",
  date: "日付",
  description: "内容",
  category: "大項目",
  memo: "メモ",
  transfer: "振替",
  id: "ID",
} as const;

/** The amount column's label carries the unit ("金額（円）"), so match on its prefix. */
const AMOUNT_PREFIX = "金額";

export const isMoneyForwardHeader = (header: ReadonlyArray<string>): boolean => {
  const names = header.map((h) => h.trim());
  return names.includes(COLUMNS.included) && names.includes(COLUMNS.transfer);
};

/**
 * Keep counted, non-transfer spending rows. The source category is the top-level 大項目
 * only: its ~18 groups are about the granularity of a ledger's categories, where 中項目
 * would mean mapping dozens of rows.
 */
export const parseMoneyForward = (table: ReadonlyArray<ReadonlyArray<string>>): ParseResult => {
  const [header, ...body] = table;
  if (!header || body.length === 0) throw new ImportFormatError("empty");

  const index = headerIndex(header);
  const amountCol = header.findIndex((h) => h.trim().startsWith(AMOUNT_PREFIX));
  const col = Object.fromEntries(
    Object.entries(COLUMNS).map(([key, name]) => [key, index.get(name) ?? -1]),
  ) as Record<keyof typeof COLUMNS, number>;
  if (amountCol < 0 || Object.values(col).some((i) => i < 0)) {
    throw new ImportFormatError("missing-columns");
  }

  const rows: ImportRow[] = [];
  const skipped = emptySkipped();

  for (const cells of body) {
    const cell = (i: number) => (cells[i] ?? "").trim();

    if (cell(col.transfer) === "1") {
      skipped.transfer++;
      continue;
    }
    if (cell(col.included) === "0") {
      skipped.excluded++;
      continue;
    }

    const amount = parseAmount(cell(amountCol));
    const date = toIsoDate(cell(col.date), "YMD");
    const id = cell(col.id);
    if (Number.isNaN(amount) || !date || !id) {
      skipped.invalid++;
      continue;
    }
    if (amount >= 0) {
      skipped.income++;
      continue;
    }

    const note = buildNote(cell(col.description), cell(col.memo));
    rows.push({
      externalId: `mf:${id}`,
      date,
      amount: roundAmount(-amount),
      currency: "JPY",
      sourceCategory: cell(col.category) || "未分類",
      ...(note ? { note } : {}),
    });
  }

  return { rows, skipped };
};
