import { describe, it, expect, beforeEach } from "vite-plus/test";
import {
  FALLBACK_CURRENCY,
  LAST_CURRENCY_KEY,
  ledgerStartCurrency,
  pickLedgerCurrency,
  pickPostCurrency,
  postStartCurrency,
  readLastCurrency,
} from "@/utils/currency";

describe("pickPostCurrency", () => {
  it("prefers the last currency used on this device", () => {
    expect(pickPostCurrency({ defaultCurrency: "CAD", lastCurrency: "EUR" })).toBe("EUR");
  });

  it("falls back to the user's default when nothing valid was used here", () => {
    expect(pickPostCurrency({ defaultCurrency: "CAD" })).toBe("CAD");
    expect(pickPostCurrency({ defaultCurrency: "CAD", lastCurrency: "DOGE" })).toBe("CAD");
  });

  it("falls back to the app default when there's neither", () => {
    expect(pickPostCurrency({})).toBe(FALLBACK_CURRENCY);
    expect(pickPostCurrency({ defaultCurrency: "nope", lastCurrency: null })).toBe(
      FALLBACK_CURRENCY,
    );
  });
});

describe("pickLedgerCurrency", () => {
  it("prefers the user's explicit default", () => {
    expect(pickLedgerCurrency({ defaultCurrency: "CAD", lastCurrency: "EUR" })).toBe("CAD");
  });

  it("falls back to the last-used currency, then the app default", () => {
    expect(pickLedgerCurrency({ lastCurrency: "EUR" })).toBe("EUR");
    expect(pickLedgerCurrency({ defaultCurrency: "DOGE", lastCurrency: "EUR" })).toBe("EUR");
    expect(pickLedgerCurrency({})).toBe(FALLBACK_CURRENCY);
  });
});

describe("device-backed helpers", () => {
  beforeEach(() => localStorage.clear());

  it("readLastCurrency ignores junk", () => {
    expect(readLastCurrency()).toBeUndefined();
    localStorage.setItem(LAST_CURRENCY_KEY, "DOGE");
    expect(readLastCurrency()).toBeUndefined();
    localStorage.setItem(LAST_CURRENCY_KEY, "GBP");
    expect(readLastCurrency()).toBe("GBP");
  });

  it("postStartCurrency and ledgerStartCurrency read this device", () => {
    localStorage.setItem(LAST_CURRENCY_KEY, "GBP");
    expect(postStartCurrency({ defaultCurrency: "USD" })).toBe("GBP");
    expect(ledgerStartCurrency({ defaultCurrency: "USD" })).toBe("USD");
    expect(ledgerStartCurrency(undefined)).toBe("GBP");
  });
});
