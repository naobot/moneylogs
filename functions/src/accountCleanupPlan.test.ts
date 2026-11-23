import { describe, it, expect } from "vite-plus/test";
import { cleanupReason, hasTies, lastActiveMs, type CleanupAccount } from "./accountCleanupPlan";

const NOW = Date.parse("2026-12-31T00:00:00Z");
const DAYS_AGO = (n: number) => new Date(NOW - n * 24 * 60 * 60 * 1000).toUTCString();

const account = (over: Partial<CleanupAccount> = {}): CleanupAccount => ({
  guest: false,
  emailVerified: false,
  admin: false,
  creationTime: DAYS_AGO(90),
  lastSignInTime: DAYS_AGO(60),
  lastRefreshTime: DAYS_AGO(31),
  ...over,
});

describe("cleanupReason", () => {
  it("takes idle guests", () => {
    expect(cleanupReason(account({ guest: true }), NOW)).toBe("idle_guest");
  });

  it("takes idle accounts that never confirmed their email", () => {
    expect(cleanupReason(account(), NOW)).toBe("idle_unconfirmed");
  });

  it("keeps anyone used in the last 30 days, by sign-in or token refresh", () => {
    expect(cleanupReason(account({ guest: true, lastRefreshTime: DAYS_AGO(29) }), NOW)).toBeNull();
    expect(
      cleanupReason(account({ lastSignInTime: DAYS_AGO(2), lastRefreshTime: null }), NOW),
    ).toBeNull();
    expect(
      cleanupReason(
        account({ creationTime: DAYS_AGO(5), lastSignInTime: null, lastRefreshTime: null }),
        NOW,
      ),
    ).toBeNull();
  });

  it("keeps confirmed accounts however long they've been away", () => {
    expect(
      cleanupReason(account({ emailVerified: true, lastRefreshTime: DAYS_AGO(400) }), NOW),
    ).toBeNull();
  });

  it("never takes an admin", () => {
    expect(cleanupReason(account({ admin: true }), NOW)).toBeNull();
    expect(cleanupReason(account({ admin: true, guest: true }), NOW)).toBeNull();
  });

  it("leaves an account alone when it can't tell when it was used", () => {
    expect(
      cleanupReason(
        account({ creationTime: null, lastSignInTime: null, lastRefreshTime: "nonsense" }),
        NOW,
      ),
    ).toBeNull();
  });
});

describe("lastActiveMs", () => {
  it("is the latest of creation, sign-in and refresh", () => {
    expect(lastActiveMs(account())).toBe(Date.parse(DAYS_AGO(31)));
  });
});

describe("hasTies", () => {
  it("keeps an account with a friend, a pending request or a shared log", () => {
    expect(hasTies({ friendships: 1, sharedLogs: 0 })).toBe(true);
    expect(hasTies({ friendships: 0, sharedLogs: 1 })).toBe(true);
    expect(hasTies({ friendships: 0, sharedLogs: 0 })).toBe(false);
  });
});
