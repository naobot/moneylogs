import { describe, it, expect } from "vite-plus/test";
import { CONFIRM_EMAIL_CUTOFF_MS, EMAIL_UNCONFIRMED, isEmailConfirmed } from "./confirmEmailPlan";
import * as app from "../../src/utils/confirmedEmail";

describe("isEmailConfirmed", () => {
  it("lets a verified email through", () => {
    expect(
      isEmailConfirmed({ emailVerified: true, creationTime: "Mon, 30 Nov 2026 10:00:00 GMT" }),
    ).toBe(true);
  });

  it("grandfathers accounts made up to the end of 22 Nov, Pacific", () => {
    expect(
      isEmailConfirmed({ emailVerified: false, creationTime: "Mon, 02 Mar 2026 10:00:00 GMT" }),
    ).toBe(true);
    // 22 Nov, 11:59pm in Vancouver.
    expect(isEmailConfirmed({ creationTime: "Mon, 23 Nov 2026 07:59:59 GMT" })).toBe(true);
  });

  it("asks newer unverified accounts to confirm", () => {
    expect(
      isEmailConfirmed({ emailVerified: false, creationTime: "Mon, 23 Nov 2026 08:00:00 GMT" }),
    ).toBe(false);
    expect(isEmailConfirmed({ emailVerified: false })).toBe(false);
    expect(isEmailConfirmed({ creationTime: "not a date" })).toBe(false);
  });

  it("never counts a guest as confirmed, even one made before the cutoff", () => {
    expect(
      isEmailConfirmed({ anonymous: true, creationTime: "Mon, 02 Mar 2026 10:00:00 GMT" }),
    ).toBe(false);
  });

  it("matches the app's copy", () => {
    expect(app.CONFIRM_EMAIL_CUTOFF_MS).toBe(CONFIRM_EMAIL_CUTOFF_MS);
    expect(app.EMAIL_UNCONFIRMED).toBe(EMAIL_UNCONFIRMED);
    for (const account of [
      { emailVerified: true },
      { creationTime: "Mon, 23 Nov 2026 07:59:59 GMT" },
      { creationTime: "Mon, 23 Nov 2026 08:00:00 GMT" },
      { anonymous: true, creationTime: "Mon, 02 Mar 2026 10:00:00 GMT" },
    ]) {
      expect(app.isEmailConfirmed(account)).toBe(isEmailConfirmed(account));
    }
  });
});
