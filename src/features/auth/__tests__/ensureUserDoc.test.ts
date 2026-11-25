import { describe, it, expect, vi } from "vite-plus/test";

vi.mock("@/config/firebase-config", () => ({ functions: {} }));
vi.mock("firebase/functions", () => ({ httpsCallable: () => vi.fn() }));

import { missingUserDocDelay, USER_DOC_GRACE_MS } from "../ensureUserDoc";

describe("missingUserDocDelay", () => {
  const created = "Wed, 25 Nov 2026 10:00:00 GMT";
  const at = (seconds: number) => Date.parse(created) + seconds * 1000;

  it("asks straight away for an account older than the grace period", () => {
    expect(missingUserDocDelay(created, at(3600))).toBe(0);
  });

  it("waits out the rest of the grace period for a brand-new account", () => {
    expect(missingUserDocDelay(created, at(10))).toBe(USER_DOC_GRACE_MS - 10_000);
  });

  it("waits the whole grace period when the creation time is unknown", () => {
    expect(missingUserDocDelay(undefined, at(0))).toBe(USER_DOC_GRACE_MS);
    expect(missingUserDocDelay("not a date", at(0))).toBe(USER_DOC_GRACE_MS);
  });
});
