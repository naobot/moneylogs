/**
 * A social post's spending, per currency.
 *
 * Posts written before multi-currency posts hold one `amount` + `currency`. Newer posts
 * also hold an `amounts` map ({JPY: 3000, CAD: 12}) and still write `amount`/`currency`
 * as the primary (first) row, so older clients keep showing something sensible. Every
 * reader goes through postAmounts() so both shapes count the same.
 *
 * Shared by the Cloud Functions and the web app; keep it dependency-free.
 */

export type AmountsMap<C extends string = string> = Partial<Record<C, number>>;

export type PostAmountFields<C extends string = string> = {
  amount?: number | string | null;
  currency?: C | null;
  amounts?: AmountsMap<C> | null;
};

const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * The post's amounts per currency: its `amounts` map, else its legacy single amount.
 *
 * Every write keeps the legacy amount/currency equal to one of the map's entries. If
 * they disagree, a client from before multi-currency posts edited it and left the map
 * stale, so the legacy fields win: they replace their own currency's entry, or, when
 * the currency itself was changed (so it's unknowable which entry it replaced), they
 * stand alone.
 */
export const postAmounts = <C extends string>(post: PostAmountFields<C>): AmountsMap<C> => {
  const map: AmountsMap<C> = {};
  if (post.amounts) {
    for (const [currency, value] of Object.entries(post.amounts) as [C, unknown][]) {
      const n = Number(value);
      if (Number.isFinite(n)) map[currency] = n;
    }
  }
  if (!post.currency) return map;

  const legacy = Number(post.amount) || 0;
  if (Object.keys(map).length === 0) return { [post.currency]: legacy } as AmountsMap<C>;
  const mapped = map[post.currency];
  if (mapped === undefined) return { [post.currency]: legacy } as AmountsMap<C>;
  if (Math.abs(mapped - legacy) > 1e-9) map[post.currency] = legacy;
  return map;
};

/** The post's amount in one currency, 0 when it has none in it. */
export const postAmountIn = <C extends string>(post: PostAmountFields<C>, currency: C): number =>
  postAmounts(post)[currency] ?? 0;

export type AmountRow<C extends string = string> = { currency: C; amount: number };

/**
 * Editor rows → an amounts map. Merges rows that share a currency and drops empty or
 * zero rows, but always keeps the first (primary) currency, even at 0: "spent nothing
 * today" is a real post. Rounds to 2dp.
 */
export const normaliseAmounts = <C extends string>(
  rows: ReadonlyArray<AmountRow<C>>,
): AmountsMap<C> => {
  const out: AmountsMap<C> = {};
  rows.forEach(({ currency, amount }, i) => {
    const n = Number(amount);
    const value = Number.isFinite(n) ? n : 0;
    if (value === 0 && i > 0) return;
    out[currency] = round2((out[currency] ?? 0) + value);
  });
  return out;
};

/**
 * The legacy amount/currency for a map: the preferred currency if it's in the map, else
 * the first entry. Falls back to `fallback` at 0 for an empty map.
 */
export const primaryOf = <C extends string>(
  amounts: AmountsMap<C>,
  fallback: C,
  preferred?: C,
): AmountRow<C> => {
  if (preferred && amounts[preferred] !== undefined) {
    return { currency: preferred, amount: amounts[preferred]! };
  }
  const first = (Object.entries(amounts) as [C, number][])[0];
  return first ? { currency: first[0], amount: first[1] } : { currency: fallback, amount: 0 };
};

/** Add `extra` into `base` per currency (2dp). Does not mutate. */
export const addAmounts = <C extends string>(
  base: AmountsMap<C>,
  extra: AmountsMap<C>,
): AmountsMap<C> => {
  const out: AmountsMap<C> = { ...base };
  for (const [currency, value] of Object.entries(extra) as [C, number][]) {
    out[currency] = round2((out[currency] ?? 0) + value);
  }
  return out;
};
