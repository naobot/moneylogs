import { describe, it, expect } from "vite-plus/test";
import {
  displayLocationError,
  displayNameError,
  isWelcomeStepValid,
  MAX_DISPLAY_NAME_LENGTH,
  onboardingRedirect,
  reachableWelcomeStep,
  WelcomeState,
} from "../welcomeSteps";

const complete: WelcomeState = {
  displayName: "Nao",
  displayLocation: "",
  timezone: "Asia/Tokyo",
  defaultCurrency: "JPY",
};

describe("validators", () => {
  it("requires a trimmed, not-too-long display name", () => {
    expect(displayNameError("")).toBeTruthy();
    expect(displayNameError("   ")).toBeTruthy();
    expect(displayNameError("x".repeat(MAX_DISPLAY_NAME_LENGTH + 1))).toBeTruthy();
    expect(displayNameError(" Nao ")).toBeUndefined();
  });

  it("lets the location be empty", () => {
    expect(displayLocationError("")).toBeUndefined();
    expect(isWelcomeStepValid("location", complete)).toBe(true);
    expect(displayLocationError("x".repeat(100))).toBeTruthy();
  });

  it("needs a timezone and a real currency", () => {
    expect(isWelcomeStepValid("timezone", { ...complete, timezone: "" })).toBe(false);
    expect(isWelcomeStepValid("currency", complete)).toBe(true);
    expect(isWelcomeStepValid("currency", { ...complete, defaultCurrency: "DOGE" as never })).toBe(
      false,
    );
  });
});

describe("reachableWelcomeStep", () => {
  it("allows any step when everything before it is answered", () => {
    expect(reachableWelcomeStep(4, complete)).toBe(4);
    expect(reachableWelcomeStep(2, complete)).toBe(2);
  });

  it("clamps out-of-range and junk requests", () => {
    expect(reachableWelcomeStep(99, complete)).toBe(4);
    expect(reachableWelcomeStep(-3, complete)).toBe(0);
    expect(reachableWelcomeStep(NaN, complete)).toBe(0);
  });

  it("stops at the first unanswered step", () => {
    expect(reachableWelcomeStep(4, { ...complete, displayName: "" })).toBe(0);
    expect(reachableWelcomeStep(4, { ...complete, timezone: "" })).toBe(2);
  });
});

describe("onboardingRedirect", () => {
  const pending = { onboardingPending: true };

  it("leaves finished and existing users alone", () => {
    expect(onboardingRedirect(undefined, { pathname: "/" })).toBeNull();
    expect(onboardingRedirect({}, { pathname: "/me" })).toBeNull();
  });

  it("sends a pending user to the wizard", () => {
    expect(onboardingRedirect(pending, { pathname: "/" })).toBe("/welcome");
    expect(onboardingRedirect(pending, { pathname: "/me" })).toBe("/welcome?next=%2Fme");
  });

  it("keeps where they were headed, query and hash included", () => {
    expect(
      onboardingRedirect(pending, { pathname: "/g/abc/invite", search: "?x=1", hash: "#y" }),
    ).toBe(`/welcome?next=${encodeURIComponent("/g/abc/invite?x=1#y")}`);
  });

  it("doesn't loop on the wizard itself, login or about", () => {
    expect(onboardingRedirect(pending, { pathname: "/welcome" })).toBeNull();
    expect(onboardingRedirect(pending, { pathname: "/login" })).toBeNull();
    expect(onboardingRedirect(pending, { pathname: "/about" })).toBeNull();
  });
});
