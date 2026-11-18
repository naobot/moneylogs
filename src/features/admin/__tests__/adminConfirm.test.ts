import { describe, it, expect } from "vite-plus/test";
import { accountConfirmPhrase, confirmsAccount } from "../adminConfirm";

describe("confirmsAccount", () => {
  const withEmail = { uid: "u1", email: "Test@Example.com" };
  const noEmail = { uid: "u1", email: null };

  it("asks for the email, or the uid without one", () => {
    expect(accountConfirmPhrase(withEmail)).toBe("Test@Example.com");
    expect(accountConfirmPhrase(noEmail)).toBe("u1");
  });

  it("matches trimmed and case-insensitively", () => {
    expect(confirmsAccount("  test@example.com ", withEmail)).toBe(true);
    expect(confirmsAccount("u1", withEmail)).toBe(false);
    expect(confirmsAccount("u1", noEmail)).toBe(true);
    expect(confirmsAccount("   ", noEmail)).toBe(false);
  });
});
