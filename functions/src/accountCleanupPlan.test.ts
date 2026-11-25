import { describe, it, expect, vi } from "vite-plus/test";
import {
  asList,
  cleanupReason,
  planCleanupDelete,
  hasTies,
  lastActiveMs,
  type CleanupAccount,
} from "./accountCleanupPlan";

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
  it("never lists an account with the keep claim", () => {
    expect(cleanupReason(account({ keep: true }), NOW)).toBeNull();
    expect(cleanupReason(account({ keep: true, guest: true }), NOW)).toBeNull();
  });

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

describe("asList", () => {
  it("reads a malformed list field as empty instead of throwing", () => {
    expect(asList(["a", "b"])).toEqual(["a", "b"]);
    for (const bad of [undefined, null, "group-1", 3, { 0: "a" }]) expect(asList(bad)).toEqual([]);
  });
});

describe("planCleanupDelete", () => {
  const plan = (exists: boolean, inProgress: boolean, eligible: boolean) => {
    const check = vi.fn(async () => eligible);
    return { step: planCleanupDelete({ exists, inProgress, eligible: check }), check };
  };

  it("finishes a deletion that stopped partway without asking about eligibility again", async () => {
    // They signed in since (so they'd look active), but their logs may already be gone.
    const { step, check } = plan(true, true, false);
    expect(await step).toBe("resume");
    expect(check).not.toHaveBeenCalled();
  });

  it("keeps someone no longer up for cleanup, and starts on someone who is", async () => {
    expect(await plan(true, false, false).step).toBe("kept");
    expect(await plan(true, false, true).step).toBe("start");
  });

  it("has nothing to do once the Auth account is gone", async () => {
    expect(await plan(false, true, true).step).toBe("gone");
    expect(await plan(false, false, true).step).toBe("gone");
  });
});
