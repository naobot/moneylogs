import { describe, expect, it, vi } from "vite-plus/test";
import { FirebaseError } from "firebase/app";

vi.mock("@/config/firebase-config", () => ({ db: {} }));

import { ledgerAccessFromRead } from "../useLedgerAccess";

describe("ledgerAccessFromRead", () => {
  it("reads a log you can see as membership", () => {
    expect(ledgerAccessFromRead({ exists: true })).toBe("member");
  });

  it("reads a missing log as not found", () => {
    expect(ledgerAccessFromRead({ exists: false })).toBe("not-found");
  });

  it("reads a rules denial as not being a member", () => {
    const error = new FirebaseError("permission-denied", "Missing or insufficient permissions.");
    expect(ledgerAccessFromRead({ error })).toBe("not-member");
  });

  it("reads anything else as an error", () => {
    expect(ledgerAccessFromRead({ error: new FirebaseError("unavailable", "offline") })).toBe(
      "error",
    );
    expect(ledgerAccessFromRead({ error: new Error("boom") })).toBe("error");
  });
});
