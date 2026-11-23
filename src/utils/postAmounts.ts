import { Currency, LogPost } from "@/types/user";
import { CurrencyAmounts } from "@/types/ledger";
import {
  addAmounts as addAmountsShared,
  AmountRow,
  normaliseAmounts as normaliseShared,
  postAmountIn as postAmountInShared,
  postAmounts as postAmountsShared,
  primaryOf as primaryOfShared,
} from "../../functions/src/postAmounts";

/** Typed wrappers over the shared functions/src/postAmounts (see there for the why). */

type PostLike = Pick<LogPost, "amount" | "currency"> & { amounts?: CurrencyAmounts };

export const postAmounts = (post: PostLike): CurrencyAmounts => postAmountsShared<Currency>(post);

export const postAmountIn = (post: PostLike, currency: Currency): number =>
  postAmountInShared<Currency>(post, currency);

export const normaliseAmounts = (rows: ReadonlyArray<AmountRow<Currency>>): CurrencyAmounts =>
  normaliseShared<Currency>(rows);

export const primaryOf = (amounts: CurrencyAmounts, fallback: Currency, preferred?: Currency) =>
  primaryOfShared<Currency>(amounts, fallback, preferred);

export const addAmounts = (base: CurrencyAmounts, extra: CurrencyAmounts): CurrencyAmounts =>
  addAmountsShared<Currency>(base, extra);

/** Map → editor rows, keeping the map's order (the first row is the primary). */
export const amountRows = (amounts: CurrencyAmounts): AmountRow<Currency>[] =>
  (Object.entries(amounts) as [Currency, number][]).map(([currency, amount]) => ({
    currency,
    amount,
  }));

export type { AmountRow };
