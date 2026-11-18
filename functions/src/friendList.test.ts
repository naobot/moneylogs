import { describe, it, expect } from "vite-plus/test";
import {
  acceptedFriendIds,
  friendshipFlipped,
  hiddenFromFriendLists,
  pairUsers,
  sameIds,
  showsFriendList,
} from "./friendList";

const at = (ms: number) => ({ toMillis: () => ms });

describe("friends list switches", () => {
  it("shows the list only when switched on", () => {
    expect(showsFriendList(undefined)).toBe(false);
    expect(showsFriendList({})).toBe(false);
    expect(showsFriendList({ showFriends: false })).toBe(false);
    expect(showsFriendList({ showFriends: true })).toBe(true);
  });

  it("puts people on lists unless they opt out", () => {
    expect(hiddenFromFriendLists(undefined)).toBe(false);
    expect(hiddenFromFriendLists({})).toBe(false);
    expect(hiddenFromFriendLists({ hideFromFriendLists: true })).toBe(true);
  });
});

describe("acceptedFriendIds", () => {
  it("lists the other side of accepted pairs, longest-standing first", () => {
    const pairs = [
      { users: ["me", "zed"], status: "accepted", acceptedAt: at(300) },
      { users: ["amy", "me"], status: "accepted", acceptedAt: at(100) },
      { users: ["me", "pat"], status: "pending" },
      { users: ["bo", "me"], status: "accepted", acceptedAt: at(200) },
      { users: ["x", "y"], status: "accepted", acceptedAt: at(50) },
    ];
    expect(acceptedFriendIds(pairs, "me")).toEqual(["amy", "bo", "zed"]);
  });

  it("copes with missing fields", () => {
    expect(
      acceptedFriendIds([{ status: "accepted" }, { users: ["me"], status: "accepted" }], "me"),
    ).toEqual([]);
  });
});

describe("friendshipFlipped", () => {
  it("fires on becoming friends or unfriending, not on requests", () => {
    expect(friendshipFlipped(undefined, { status: "pending" })).toBe(false);
    expect(friendshipFlipped({ status: "pending" }, undefined)).toBe(false);
    expect(friendshipFlipped({ status: "pending" }, { status: "accepted" })).toBe(true);
    expect(friendshipFlipped(undefined, { status: "accepted" })).toBe(true);
    expect(friendshipFlipped({ status: "accepted" }, undefined)).toBe(true);
    expect(friendshipFlipped({ status: "accepted" }, { status: "accepted" })).toBe(false);
  });
});

describe("pairUsers / sameIds", () => {
  it("reads the pair from whichever side exists", () => {
    expect(pairUsers(undefined, { users: ["a", "b"] })).toEqual(["a", "b"]);
    expect(pairUsers({ users: ["a", "b"] }, undefined)).toEqual(["a", "b"]);
    expect(pairUsers(undefined, undefined)).toEqual([]);
  });

  it("compares in order", () => {
    expect(sameIds(["a", "b"], ["a", "b"])).toBe(true);
    expect(sameIds(["a", "b"], ["b", "a"])).toBe(false);
    expect(sameIds([], ["a"])).toBe(false);
  });
});
