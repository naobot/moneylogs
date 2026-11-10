import { describe, it, expect, beforeEach } from "vite-plus/test";
import {
  hasPersonalLedger,
  personalLedgerId,
  planPersonalLedger,
  preferredCurrency,
  PERSONAL_LEDGER_FALLBACK_CURRENCY,
} from "@/utils/personalLedger";
import { LAST_CURRENCY_KEY } from "@/utils/currency";

describe("personalLedgerId", () => {
  it("is derived from the auth uid, so it's the same every time", () => {
    expect(personalLedgerId("abc")).toBe("personal-abc");
    expect(personalLedgerId("abc")).toBe(personalLedgerId("abc"));
  });
});

describe("hasPersonalLedger", () => {
  it("is false for missing users and users without the marker", () => {
    expect(hasPersonalLedger(undefined)).toBe(false);
    expect(hasPersonalLedger({})).toBe(false);
    expect(hasPersonalLedger({ personalLedgerId: "" })).toBe(false);
  });

  it("is true once the marker is set", () => {
    expect(hasPersonalLedger({ personalLedgerId: "personal-abc" })).toBe(true);
  });
});

describe("planPersonalLedger", () => {
  it("creates the ledger and marks the user the first time", () => {
    expect(planPersonalLedger({ userMarked: false, ledgerExists: false })).toEqual({
      createLedger: true,
      markUser: true,
    });
  });

  it("only marks the user when another tab already created the ledger", () => {
    expect(planPersonalLedger({ userMarked: false, ledgerExists: true })).toEqual({
      createLedger: false,
      markUser: true,
    });
  });

  it("does nothing once the user is marked, even if they deleted the ledger", () => {
    expect(planPersonalLedger({ userMarked: true, ledgerExists: false })).toEqual({
      createLedger: false,
      markUser: false,
    });
    expect(planPersonalLedger({ userMarked: true, ledgerExists: true })).toEqual({
      createLedger: false,
      markUser: false,
    });
  });
});

describe("preferredCurrency", () => {
  beforeEach(() => localStorage.clear());

  it("uses the last currency the user picked", () => {
    localStorage.setItem(LAST_CURRENCY_KEY, "CAD");
    expect(preferredCurrency()).toBe("CAD");
  });

  it("falls back when nothing (or junk) is stored", () => {
    expect(preferredCurrency()).toBe(PERSONAL_LEDGER_FALLBACK_CURRENCY);
    localStorage.setItem(LAST_CURRENCY_KEY, "DOGE");
    expect(preferredCurrency()).toBe(PERSONAL_LEDGER_FALLBACK_CURRENCY);
  });
});
