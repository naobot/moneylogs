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
