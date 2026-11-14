import { describe, it, expect } from "vite-plus/test";
import {
  confirmsAccountDeletion,
  getDeleteAccountErrorMessage,
  getPasswordChangeErrorMessage,
  getResetEmailErrorMessage,
  validatePasswordChange,
} from "@/features/auth/accountErrors";

describe("getPasswordChangeErrorMessage", () => {
  it("blames only the current password for bad-credential codes", () => {
    expect(getPasswordChangeErrorMessage("auth/invalid-credential")).toBe(
      "Your current password is incorrect.",
    );
    expect(getPasswordChangeErrorMessage("auth/wrong-password")).toBe(
      "Your current password is incorrect.",
    );
  });

  it("maps weak or non-compliant new passwords", () => {
    expect(getPasswordChangeErrorMessage("auth/weak-password")).toBe(
      "Please choose a stronger new password.",
    );
    expect(getPasswordChangeErrorMessage("auth/password-does-not-meet-requirements")).toBe(
      "Please choose a stronger new password.",
    );
  });

  it("asks for a fresh sign-in when Firebase requires one", () => {
    expect(getPasswordChangeErrorMessage("auth/requires-recent-login")).toContain("sign back in");
  });

  it("maps rate limiting and offline", () => {
    expect(getPasswordChangeErrorMessage("auth/too-many-requests")).toBe(
      "Too many attempts. Please try again later.",
    );
    expect(getPasswordChangeErrorMessage("auth/network-request-failed")).toContain("offline");
  });

  it("falls back to a generic message", () => {
    expect(getPasswordChangeErrorMessage(undefined)).toBe(
      "Couldn't change your password. Please try again.",
    );
  });
});

describe("getResetEmailErrorMessage", () => {
  it("maps rate limiting, offline and unknown codes", () => {
    expect(getResetEmailErrorMessage("auth/too-many-requests")).toContain("wait");
    expect(getResetEmailErrorMessage("auth/network-request-failed")).toContain("offline");
    expect(getResetEmailErrorMessage("auth/internal-error")).toBe(
      "Couldn't send the reset email. Please try again.",
    );
  });
});

describe("validatePasswordChange", () => {
  const ok = { current: "old-pass", next: "new-pass", confirm: "new-pass", meetsPolicy: true };

  it("accepts a valid change", () => {
    expect(validatePasswordChange(ok)).toBeNull();
  });

  it("requires every field", () => {
    expect(validatePasswordChange({ ...ok, current: "" })).toBe("Fill in all three fields.");
    expect(validatePasswordChange({ ...ok, next: "" })).toBe("Fill in all three fields.");
    expect(validatePasswordChange({ ...ok, confirm: "" })).toBe("Fill in all three fields.");
  });

  it("rejects reusing the current password", () => {
    expect(validatePasswordChange({ ...ok, next: "old-pass", confirm: "old-pass" })).toContain(
      "must be different",
    );
  });

  it("rejects a new password that fails the policy", () => {
    expect(validatePasswordChange({ ...ok, meetsPolicy: false })).toContain("requirements");
  });

  it("rejects a mismatched confirmation", () => {
    expect(validatePasswordChange({ ...ok, confirm: "new-pazz" })).toBe(
      "The new passwords don't match.",
    );
  });
});

describe("confirmsAccountDeletion", () => {
  it("accepts the confirmation word in any case, ignoring surrounding spaces", () => {
    expect(confirmsAccountDeletion("delete")).toBe(true);
    expect(confirmsAccountDeletion("  DELETE ")).toBe(true);
  });

  it("rejects anything else", () => {
    expect(confirmsAccountDeletion("")).toBe(false);
    expect(confirmsAccountDeletion("delet")).toBe(false);
    expect(confirmsAccountDeletion("delete my account")).toBe(false);
  });
});

describe("getDeleteAccountErrorMessage", () => {
  it("blames the password for bad-credential codes", () => {
    expect(getDeleteAccountErrorMessage("auth/invalid-credential")).toBe(
      "Your password is incorrect.",
    );
    expect(getDeleteAccountErrorMessage("auth/wrong-password")).toBe("Your password is incorrect.");
  });

  it("asks for the password again when the sign-in is no longer recent", () => {
    expect(getDeleteAccountErrorMessage("functions/failed-precondition")).toMatch(
      /enter your password/,
    );
  });

  it("treats offline errors from either source the same way", () => {
    const offline = getDeleteAccountErrorMessage("auth/network-request-failed");
    expect(getDeleteAccountErrorMessage("functions/unavailable")).toBe(offline);
  });

  it("invites a retry when the deletion stopped part-way", () => {
    expect(getDeleteAccountErrorMessage("functions/internal")).toMatch(/try again/);
    expect(getDeleteAccountErrorMessage(undefined)).toMatch(/try again/);
  });
});
