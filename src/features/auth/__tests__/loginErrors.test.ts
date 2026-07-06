import { describe, it, expect } from "vite-plus/test";
import { getLoginErrorMessage } from "@/features/auth/loginErrors";

describe("getLoginErrorMessage", () => {
  it("maps bad-credential codes to an incorrect email/password message", () => {
    expect(getLoginErrorMessage("auth/invalid-credential")).toBe(
      "Incorrect email or password. Please try again.",
    );
    expect(getLoginErrorMessage("auth/wrong-password")).toBe(
      "Incorrect email or password. Please try again.",
    );
    expect(getLoginErrorMessage("auth/user-not-found")).toBe(
      "Incorrect email or password. Please try again.",
    );
  });

  it("maps malformed email addresses", () => {
    expect(getLoginErrorMessage("auth/invalid-email")).toBe("Please enter a valid email address.");
  });

  it("maps disabled accounts", () => {
    expect(getLoginErrorMessage("auth/user-disabled")).toBe("This account has been disabled.");
  });

  it("maps rate limiting", () => {
    expect(getLoginErrorMessage("auth/too-many-requests")).toBe(
      "Too many failed attempts. Please try again later.",
    );
  });

  it("falls back to a generic message for unknown or missing codes", () => {
    expect(getLoginErrorMessage("auth/network-request-failed")).toBe(
      "Something went wrong logging in. Please try again.",
    );
    expect(getLoginErrorMessage(undefined)).toBe(
      "Something went wrong logging in. Please try again.",
    );
  });
});
