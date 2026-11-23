import { Currency, LogPost } from "@/types/user";
import { CurrencyAmounts } from "@/types/ledger";
import {
  addAmounts as addAmountsShared,
  AmountRow,
  normaliseAmounts as normaliseShared,
  postAmountIn as postAmountInShared,
  postAmounts as postAmountsShared,
  primaryOf as primaryOfShared,
  rowsFor as rowsForShared,
  sameRows as sameRowsShared,
} from "../../functions/src/postAmounts";

/** Typed wrappers over the shared functions/src/postAmounts (see there for the why). */

type PostLike = Pick<LogPost, "amount" | "currency" | "amountsPrimary"> & {
  amounts?: CurrencyAmounts;
};

export const postAmounts = (post: PostLike): CurrencyAmounts => postAmountsShared<Currency>(post);

export const postAmountIn = (post: PostLike, currency: Currency): number =>
  postAmountInShared<Currency>(post, currency);

export const normaliseAmounts = (rows: ReadonlyArray<AmountRow<Currency>>): CurrencyAmounts =>
  normaliseShared<Currency>(rows);

export const primaryOf = (amounts: CurrencyAmounts, fallback: Currency, preferred?: Currency) =>
  primaryOfShared<Currency>(amounts, fallback, preferred);

export const addAmounts = (base: CurrencyAmounts, extra: CurrencyAmounts): CurrencyAmounts =>
  addAmountsShared<Currency>(base, extra);

/** A post's amounts as editor rows, primary first. */
export const amountRows = (amounts: CurrencyAmounts, primary?: Currency): AmountRow<Currency>[] =>
  rowsForShared<Currency>(amounts, primary);

export const sameRows = (
  a: ReadonlyArray<AmountRow<Currency>>,
  b: ReadonlyArray<AmountRow<Currency>>,
): boolean => sameRowsShared<Currency>(a, b);

export type { AmountRow };
