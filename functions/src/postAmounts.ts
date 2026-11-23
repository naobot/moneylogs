/**
 * A social post's spending, per currency.
 *
 * Posts written before multi-currency posts hold one `amount` + `currency`. Newer posts
 * also hold an `amounts` map ({JPY: 3000, CAD: 12}) and `amountsPrimary`, the map's
 * primary currency, and still write `amount`/`currency` as that primary entry, so older
 * clients keep showing something sensible. Every reader goes through postAmounts() so
 * both shapes count the same.
 *
 * `amountsPrimary` is needed because Firestore stores map keys sorted, so the map alone
 * can't say which entry was the primary.
 *
 * Shared by the Cloud Functions and the web app; keep it dependency-free.
 */

export type AmountsMap<C extends string = string> = Partial<Record<C, number>>;

export type PostAmountFields<C extends string = string> = {
  amount?: number | string | null;
  currency?: C | null;
  amounts?: AmountsMap<C> | null;
  amountsPrimary?: C | null;
};

const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * The post's amounts per currency: its `amounts` map, else its legacy single amount.
 *
 * Every new write keeps the legacy amount/currency equal to the map's primary entry. An
 * older client edits only the legacy fields, which describe that primary entry, so they
 * win over a stale map:
 * - same currency: the primary entry takes the legacy amount;
 * - currency switched: the old primary entry is dropped and the legacy amount is added
 *   to the new currency (on top of any secondary amount already in it, which that older
 *   client never showed or changed).
 * Secondary entries always stay. A map without `amountsPrimary` treats the legacy
 * currency as its primary.
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

  const primary = post.amountsPrimary ?? post.currency;
  if (post.currency === primary) {
    map[primary] = legacy;
    return map;
  }
  delete map[primary];
  map[post.currency] = round2((map[post.currency] ?? 0) + legacy);
  return map;
};

/** The post's amount in one currency, 0 when it has none in it. */
export const postAmountIn = <C extends string>(post: PostAmountFields<C>, currency: C): number =>
  postAmounts(post)[currency] ?? 0;

export type AmountRow<C extends string = string> = { currency: C; amount: number };

/**
 * Editor rows → an amounts map. Merges rows that share a currency and drops empty or
 * zero rows, but always keeps the first (primary) currency, even at 0: "spent nothing
 * today" is a real post. Only merged sums are rounded (to 2dp, to drop floating-point
 * noise); a single row keeps exactly what was entered.
 */
export const normaliseAmounts = <C extends string>(
  rows: ReadonlyArray<AmountRow<C>>,
): AmountsMap<C> => {
  const out: AmountsMap<C> = {};
  rows.forEach(({ currency, amount }, i) => {
    const n = Number(amount);
    const value = Number.isFinite(n) ? n : 0;
    if (value === 0 && i > 0) return;
    const prev = out[currency];
    out[currency] = prev === undefined ? value : round2(prev + value);
  });
  return out;
};

/**
 * A post's amounts as editor rows, primary first. The rest keep the map's order
 * (Firestore's sorted key order for a saved post).
 */
export const rowsFor = <C extends string>(amounts: AmountsMap<C>, primary?: C): AmountRow<C>[] => {
  const rows = (Object.entries(amounts) as [C, number][]).map(([currency, amount]) => ({
    currency,
    amount,
  }));
  const i = primary ? rows.findIndex((r) => r.currency === primary) : -1;
  return i > 0 ? [rows[i], ...rows.slice(0, i), ...rows.slice(i + 1)] : rows;
};

/** Whether two row lists are the same currencies and amounts, in the same order. */
export const sameRows = <C extends string>(
  a: ReadonlyArray<AmountRow<C>>,
  b: ReadonlyArray<AmountRow<C>>,
): boolean =>
  a.length === b.length &&
  a.every((r, i) => r.currency === b[i].currency && Number(r.amount) === Number(b[i].amount));

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
