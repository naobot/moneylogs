import { Currency } from "@/types/user";
import { parseCsv } from "./csv";
import { DateOrder } from "./dates";
import { ImportFormatError } from "./errors";
import { isMoneyForwardHeader, parseMoneyForward } from "./moneyForward";
import { ImportSource, ParseResult } from "./types";
import { isYnabHeader, parseYnabCsv } from "./ynabCsv";

/** Which supported app produced this header row, if any. */
export const detectSource = (header: ReadonlyArray<string>): ImportSource | undefined => {
  if (isMoneyForwardHeader(header)) return "moneyforward";
  if (isYnabHeader(header)) return "ynab";
  return undefined;
};

export type ImportFileOptions = {
  /** Currency for sources whose files don't say (YNAB). MoneyForward is always JPY. */
  currency: Currency;
  dateOrder?: DateOrder;
};

export type ParsedImportFile = ParseResult & { source: ImportSource };

/** Decoded CSV text → normalised spending rows, detecting the source from the header. */
export const parseImportFile = (text: string, options: ImportFileOptions): ParsedImportFile => {
  const table = parseCsv(text);
  const header = table[0];
  if (!header) throw new ImportFormatError("empty");

  const source = detectSource(header);
  if (source === "moneyforward") return { source, ...parseMoneyForward(table) };
  if (source === "ynab") return { source, ...parseYnabCsv(table, options) };
  throw new ImportFormatError("unknown-format");
};
