import { describe, expect, it } from "vite-plus/test";
import { friendIn, lastSeenOf, orderByLastSeen } from "./friendsByActivity";

describe("friendIn", () => {
  const doc = { users: ["a", "b"], uids: ["ua", "ub"], status: "accepted" };

  it("finds the other person in an accepted friendship", () => {
    expect(friendIn(doc, "ua")).toEqual({ userDocId: "b", uid: "ub" });
    expect(friendIn(doc, "ub")).toEqual({ userDocId: "a", uid: "ua" });
  });

  it("skips pending requests and malformed docs", () => {
    expect(friendIn({ ...doc, status: "pending" }, "ua")).toBeNull();
    expect(friendIn({ ...doc, uids: ["ua"] }, "ua")).toBeNull();
    expect(friendIn(doc, "uz")).toBeNull();
  });
});

describe("lastSeenOf", () => {
  it("takes the later of sign-in and refresh", () => {
    expect(
      lastSeenOf({
        lastSignInTime: "Tue, 10 Nov 2026 10:00:00 GMT",
        lastRefreshTime: "Wed, 18 Nov 2026 09:00:00 GMT",
      }),
    ).toBe(Date.parse("2026-11-18T09:00:00Z"));
    expect(lastSeenOf({ lastSignInTime: "Tue, 10 Nov 2026 10:00:00 GMT" })).toBe(
      Date.parse("2026-11-10T10:00:00Z"),
    );
    expect(lastSeenOf({ lastSignInTime: "junk", lastRefreshTime: null })).toBe(0);
  });
});

describe("orderByLastSeen", () => {
  it("puts the most recent first, keeping the given order for ties and the unknown", () => {
    const friends = [
      { userDocId: "a", uid: "ua" },
      { userDocId: "b", uid: "ub" },
      { userDocId: "c", uid: "uc" },
      { userDocId: "d", uid: "ud" },
    ];
    const seen = new Map([
      ["ua", 100],
      ["ub", 300],
      ["uc", 100],
    ]);
    expect(orderByLastSeen(friends, seen)).toEqual(["b", "a", "c", "d"]);
  });
});
