import { describe, it, expect } from "vite-plus/test";
import { getRegistrationErrorMessage } from "@/features/auth/registrationErrors";

describe("getRegistrationErrorMessage", () => {
  it("maps an already-registered email to a helpful message", () => {
    expect(getRegistrationErrorMessage("auth/email-already-in-use")).toBe(
      "An account with this email already exists. Try logging in instead.",
    );
  });

  it("maps malformed email addresses", () => {
    expect(getRegistrationErrorMessage("auth/invalid-email")).toBe(
      "Please enter a valid email address.",
    );
  });

  it("maps weak passwords", () => {
    expect(getRegistrationErrorMessage("auth/weak-password")).toBe(
      "Please choose a stronger password.",
    );
  });

  it("maps disabled sign-up", () => {
    expect(getRegistrationErrorMessage("auth/operation-not-allowed")).toBe(
      "Registration is currently unavailable. Please try again later.",
    );
  });

  it("maps rate limiting", () => {
    expect(getRegistrationErrorMessage("auth/too-many-requests")).toBe(
      "Too many attempts. Please try again later.",
    );
  });

  it("falls back to a generic message for unknown or missing codes", () => {
    expect(getRegistrationErrorMessage("auth/network-request-failed")).toBe(
      "Something went wrong creating your account. Please try again.",
    );
    expect(getRegistrationErrorMessage(undefined)).toBe(
      "Something went wrong creating your account. Please try again.",
    );
  });
});
