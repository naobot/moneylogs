/** Order of year/month/day in a source file's dates. */
export type DateOrder = "YMD" | "MDY" | "DMY";

const pad = (n: string) => n.padStart(2, "0");

const split = (raw: string): [string, string, string] | undefined => {
  const parts = raw.trim().split(/[-/.]/);
  return parts.length === 3 && parts.every((p) => /^\d+$/.test(p))
    ? (parts as [string, string, string])
    : undefined;
};

const isRealDate = (y: string, m: string, d: string): boolean => {
  const date = new Date(Date.UTC(Number(y), Number(m) - 1, Number(d)));
  return (
    y.length === 4 &&
    date.getUTCFullYear() === Number(y) &&
    date.getUTCMonth() === Number(m) - 1 &&
    date.getUTCDate() === Number(d)
  );
};

/** "2024/1/5" or "05/01/2024" → "2024-01-05" in the given order; undefined if invalid. */
export const toIsoDate = (raw: string, order: DateOrder): string | undefined => {
  const parts = split(raw);
  if (!parts) return undefined;
  const [a, b, c] = parts;
  const [y, m, d] = order === "YMD" ? [a, b, c] : order === "MDY" ? [c, a, b] : [c, b, a];
  return isRealDate(y, m, d) ? `${y}-${pad(m)}-${pad(d)}` : undefined;
};

/**
 * Work out a column's date order from all its values. Year-first is unambiguous; in
 * day/month files a first part over 12 means DMY and a second part over 12 means MDY.
 * Undefined when every date is ambiguous (or contradictory), so the importer must ask.
 */
export const detectDateOrder = (values: ReadonlyArray<string>): DateOrder | undefined => {
  let sawDmy = false;
  let sawMdy = false;
  for (const value of values) {
    const parts = split(value);
    if (!parts) continue;
    if (parts[0].length === 4) return "YMD";
    if (Number(parts[0]) > 12) sawDmy = true;
    if (Number(parts[1]) > 12) sawMdy = true;
  }
  if (sawDmy === sawMdy) return undefined;
  return sawDmy ? "DMY" : "MDY";
};
