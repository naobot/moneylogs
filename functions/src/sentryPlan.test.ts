import { describe, it, expect } from "vite-plus/test";
import { invocationContext, shouldReport } from "./sentryPlan";

/** Shaped like firebase-functions' HttpsError. */
const httpsError = (code: string) =>
  Object.assign(new Error(code), { code, httpErrorCode: { canonicalName: code, status: 400 } });

describe("shouldReport", () => {
  it("skips HttpsErrors that answer the caller on purpose", () => {
    for (const code of ["invalid-argument", "permission-denied", "not-found", "unauthenticated"]) {
      expect(shouldReport(httpsError(code))).toBe(false);
    }
  });

  it("reports internal HttpsErrors and anything else", () => {
    expect(shouldReport(httpsError("internal"))).toBe(true);
    expect(shouldReport(httpsError("unknown"))).toBe(true);
    expect(shouldReport(new Error("boom"))).toBe(true);
    // A Firestore gRPC error has a numeric code and no httpErrorCode.
    expect(shouldReport(Object.assign(new Error("x"), { code: 5 }))).toBe(true);
    expect(shouldReport("thrown string")).toBe(true);
    expect(shouldReport(null)).toBe(true);
  });
});

describe("invocationContext", () => {
  it("takes the caller's uid from a callable request", () => {
    expect(
      invocationContext("deleteLog", { auth: { uid: "u1", token: {} }, data: { x: 1 } }),
    ).toEqual({ fn: "deleteLog", uid: "u1" });
  });

  it("takes string params from a trigger event", () => {
    expect(
      invocationContext("recomputeLedgerMonth", {
        params: { ledgerId: "L1", entryId: "E1", odd: 3 },
        data: {},
      }),
    ).toEqual({ fn: "recomputeLedgerMonth", params: { ledgerId: "L1", entryId: "E1" } });
  });

  it("adds nothing for unauthenticated calls or scheduler events", () => {
    expect(invocationContext("f", { auth: null, data: {} })).toEqual({ fn: "f" });
    expect(invocationContext("f", { scheduleTime: "now" })).toEqual({ fn: "f" });
    expect(invocationContext("f", undefined)).toEqual({ fn: "f" });
  });
});
