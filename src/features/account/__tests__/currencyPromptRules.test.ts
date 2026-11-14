import { describe, it, expect } from "vite-plus/test";
import { needsDefaultCurrencyPrompt } from "../currencyPromptRules";

describe("needsDefaultCurrencyPrompt", () => {
  it("asks a signed-in user who has no default yet", () => {
    expect(needsDefaultCurrencyPrompt({}, "/")).toBe(true);
    expect(needsDefaultCurrencyPrompt({}, "/l/personal-abc")).toBe(true);
  });

  it("never asks signed-out users or users who already chose", () => {
    expect(needsDefaultCurrencyPrompt(undefined, "/")).toBe(false);
    expect(needsDefaultCurrencyPrompt({ defaultCurrency: "CAD" }, "/")).toBe(false);
  });

  it("leaves new users to the welcome wizard", () => {
    expect(needsDefaultCurrencyPrompt({ onboardingPending: true }, "/")).toBe(false);
  });

  it("stays quiet on login, welcome and about", () => {
    expect(needsDefaultCurrencyPrompt({}, "/login")).toBe(false);
    expect(needsDefaultCurrencyPrompt({}, "/welcome")).toBe(false);
    expect(needsDefaultCurrencyPrompt({}, "/about")).toBe(false);
    expect(needsDefaultCurrencyPrompt({}, "/aboutface")).toBe(true);
  });
});
