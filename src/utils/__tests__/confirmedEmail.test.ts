import { describe, it, expect } from "vite-plus/test";
import { isEmailUnconfirmedError } from "../confirmedEmail";

describe("isEmailUnconfirmedError", () => {
  it("spots the callable's reason", () => {
    expect(
      isEmailUnconfirmedError({
        code: "functions/failed-precondition",
        details: { reason: "email_unconfirmed" },
      }),
    ).toBe(true);
  });

  it("ignores other failures", () => {
    expect(isEmailUnconfirmedError({ code: "functions/failed-precondition" })).toBe(false);
    expect(isEmailUnconfirmedError(new Error("nope"))).toBe(false);
    expect(isEmailUnconfirmedError(null)).toBe(false);
  });
});
