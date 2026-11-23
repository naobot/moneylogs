import { describe, it, expect, vi } from "vite-plus/test";

vi.mock("@/config/firebase-config", () => ({ auth: {}, db: {} }));

import { getGuestSaveErrorMessage, isExpectedGuestSaveError, isGuest } from "../guest";

describe("isGuest", () => {
  it("is an anonymous sign-in", () => {
    expect(isGuest({ isAnonymous: true })).toBe(true);
    expect(isGuest({ isAnonymous: false })).toBe(false);
    expect(isGuest(null)).toBe(false);
  });
});

describe("getGuestSaveErrorMessage", () => {
  it("explains a taken email without promising their guest logs come along", () => {
    for (const code of ["auth/email-already-in-use", "auth/credential-already-in-use"]) {
      expect(getGuestSaveErrorMessage(code)).toMatch(/already has an account/);
      expect(getGuestSaveErrorMessage(code)).toMatch(/won't come along/);
    }
  });

  it("reuses registration's wording for fixable mistakes", () => {
    expect(getGuestSaveErrorMessage("auth/invalid-email")).toBe(
      "Please enter a valid email address.",
    );
  });

  it("falls back to a save-specific message", () => {
    expect(getGuestSaveErrorMessage("auth/internal-error")).toBe(
      "Couldn't save your account. Please try again.",
    );
    expect(getGuestSaveErrorMessage()).toBe("Couldn't save your account. Please try again.");
  });

  it("treats taken emails as expected, not as bugs", () => {
    expect(isExpectedGuestSaveError("auth/credential-already-in-use")).toBe(true);
    expect(isExpectedGuestSaveError("auth/internal-error")).toBe(false);
  });
});
