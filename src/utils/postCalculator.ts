import { Currency } from "@/types/user";

/**
 * The post editor's calculator: sums the amounts written in a post's text for one
 * currency row.
 *
 * Two forms count:
 * - the currency code after the number ("1,200 JPY", "45.50 CAD"), which always works
 *   and is the form lines pulled in from financial logs use;
 * - the currency's symbol ("¥1,200", "$4.50"), but only when no other row on the post
 *   shares that symbol: "$" could be USD, CAD, NTD, AUD or SGD.
 */

const SYMBOL_PATTERNS: Partial<Record<Currency, { symbol: string; re: RegExp }>> = {
  JPY: { symbol: "¥", re: /-?([¥￥])-?(\d+,)*\d+万?/g },
  CNY: { symbol: "¥", re: /-?([¥￥])-?(\d+,)*\d+万?/g },
  USD: { symbol: "$", re: /-?(\$)-?(\d+,)*\d+(\.\d\d)?/g },
  CAD: { symbol: "$", re: /-?(\$)-?(\d+,)*\d+(\.\d\d)?/g },
  NTD: { symbol: "$", re: /-?(\$)-?(\d+,)*\d+(\.\d\d)?/g },
  AUD: { symbol: "$", re: /-?(\$)-?(\d+,)*\d+(\.\d\d)?/g },
  SGD: { symbol: "$", re: /-?(\$)-?(\d+,)*\d+(\.\d\d)?/g },
  KRW: { symbol: "₩", re: /-?(₩)-?(\d+,)*\d+k?/g },
  EUR: { symbol: "€", re: /-?(€)-?(\d+,)*\d+(\.\d\d)?/g },
  GBP: { symbol: "£", re: /-?(£)-?(\d+,)*\d+(\.\d\d)?/g },
  MYR: { symbol: "RM", re: /-?(\d+,)*\d+(?=\w?RM)/g },
};

// A minus may sit before or after an optional symbol: "-$5 CAD", "$-5 CAD", "-5 CAD".
const SIGNED_NUMBER = "(-?)[¥￥$₩€£]?(-?)(\\d[\\d,]*(?:\\.\\d+)?)(k|万)?";

const codePattern = (currency: Currency) => new RegExp(`${SIGNED_NUMBER}\\s?${currency}\\b`, "g");

const parseAmount = (raw: string): number =>
  Number(
    raw
      .replaceAll(/[¥￥$₩€£,\s]/g, "")
      .replaceAll("k", "000")
      .replaceAll("万", "0000"),
  );

/** Whether `currency`'s symbol is shared with another currency on the post. */
const symbolIsAmbiguous = (currency: Currency, rowCurrencies: ReadonlyArray<Currency>) => {
  const symbol = SYMBOL_PATTERNS[currency]?.symbol;
  return rowCurrencies.some((c) => c !== currency && SYMBOL_PATTERNS[c]?.symbol === symbol);
};

/**
 * The total written in `text` for `currency`, rounded to 2dp, or undefined when nothing
 * in the text is for that currency.
 */
export const sumAmountsIn = (
  text: string,
  currency: Currency,
  rowCurrencies: ReadonlyArray<Currency> = [currency],
): number | undefined => {
  const found: number[] = [];

  // Code form first, then blank those matches out so "¥1,200 JPY" isn't counted twice.
  let rest = text;
  for (const [, signA, signB, digits, suffix] of text.matchAll(codePattern(currency))) {
    const sign = signA || signB ? -1 : 1;
    found.push(sign * parseAmount(`${digits}${suffix ?? ""}`));
  }
  rest = rest.replace(codePattern(currency), " ");
  // Drop every other currency's code-form amounts too, so "$5 CAD" isn't read as USD.
  rest = rest.replace(new RegExp(`${SIGNED_NUMBER}\\s?[A-Z]{3}\\b`, "g"), " ");

  const symbol = SYMBOL_PATTERNS[currency];
  if (symbol && !symbolIsAmbiguous(currency, rowCurrencies)) {
    for (const match of rest.match(new RegExp(symbol.re.source, "g")) ?? []) {
      found.push(parseAmount(match));
    }
  }

  const valid = found.filter((n) => Number.isFinite(n));
  if (valid.length === 0) return undefined;
  return Math.round(valid.reduce((a, b) => a + b, 0) * 100) / 100;
};
