import { Currency } from "@/types/user";

// Display order for currency pickers, shared by social posts and financial entries.
export const CURRENCIES: Array<Currency> = [
  "JPY",
  "USD",
  "CAD",
  "KRW",
  "CNY",
  "SGD",
  "EUR",
  "GBP",
  "NTD",
  "AUD",
  "MYR",
];

export const LAST_CURRENCY_KEY = "ML__lastCurrency";

export const isCurrency = (value: unknown): value is Currency =>
  typeof value === "string" && (CURRENCIES as string[]).includes(value);

/** The app-wide fallback when a user has neither a default nor a last-used currency. */
export const FALLBACK_CURRENCY: Currency = "JPY";

/** The currency last picked in a post editor on this device, if it's still a valid one. */
export const readLastCurrency = (): Currency | undefined => {
  try {
    const last = localStorage.getItem(LAST_CURRENCY_KEY);
    return isCurrency(last) ? last : undefined;
  } catch {
    return undefined;
  }
};

type CurrencyChoice = {
  /** The user's explicit default (users.defaultCurrency). */
  defaultCurrency?: unknown;
  /** The last currency picked on this device (ML__lastCurrency). */
  lastCurrency?: unknown;
};

/**
 * Which currency a new social post starts on: what you last used on this device (you're
 * probably still travelling in it), else your default, else the app fallback.
 */
export const pickPostCurrency = ({ defaultCurrency, lastCurrency }: CurrencyChoice): Currency =>
  isCurrency(lastCurrency)
    ? lastCurrency
    : isCurrency(defaultCurrency)
      ? defaultCurrency
      : FALLBACK_CURRENCY;

/**
 * Which currency a new ledger starts on: your explicit default first, since a ledger
 * outlives any one trip, else what you last used, else the app fallback.
 */
export const pickLedgerCurrency = ({ defaultCurrency, lastCurrency }: CurrencyChoice): Currency =>
  isCurrency(defaultCurrency)
    ? defaultCurrency
    : isCurrency(lastCurrency)
      ? lastCurrency
      : FALLBACK_CURRENCY;

/** pickPostCurrency for a user, reading this device's last-used currency. */
export const postStartCurrency = (user?: { defaultCurrency?: Currency }): Currency =>
  pickPostCurrency({ defaultCurrency: user?.defaultCurrency, lastCurrency: readLastCurrency() });

/** pickLedgerCurrency for a user, reading this device's last-used currency. */
export const ledgerStartCurrency = (user?: { defaultCurrency?: Currency }): Currency =>
  pickLedgerCurrency({ defaultCurrency: user?.defaultCurrency, lastCurrency: readLastCurrency() });
