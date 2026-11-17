import { MAX_NOTE_LENGTH } from "@/utils/ledger";

/**
 * Join note parts and cut to the ledger's note limit without splitting a surrogate pair.
 * Returns undefined when nothing is left, so the entry stores no note at all.
 */
export const buildNote = (...parts: Array<string | undefined>): string | undefined => {
  const joined = parts
    .map((p) => p?.trim())
    .filter(Boolean)
    .join(" — ");
  if (!joined) return undefined;
  let out = "";
  for (const ch of joined) {
    if (out.length + ch.length > MAX_NOTE_LENGTH) break;
    out += ch;
  }
  return out;
};

/**
 * Read an amount like "-1,200", "¥1,200", "$12.34" or "−5.00". Strips currency symbols,
 * spaces and thousands commas. NaN when nothing numeric remains.
 */
export const parseAmount = (raw: string): number => {
  const cleaned = raw.replace(/−/g, "-").replace(/[^\d.-]/g, "");
  if (!/\d/.test(cleaned)) return NaN;
  return Number(cleaned);
};

/** Round to 2dp so float noise from "12.34"-style strings never reaches the ledger. */
export const roundAmount = (n: number): number => Math.round(n * 100) / 100;

/** Decode a file's bytes: strict UTF-8 first, else Shift-JIS (MoneyForward's export). */
export const decodeBytes = (bytes: ArrayBuffer | Uint8Array): string => {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return new TextDecoder("shift_jis").decode(bytes);
  }
};
