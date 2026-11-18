import { describe, it, expect } from "vite-plus/test";
import { pickableFriends, toggleFriend } from "@/features/invites/friendPicking";

describe("pickableFriends", () => {
  it("leaves out friends already in the log, keeping order", () => {
    expect(pickableFriends(["a", "b", "c"], ["b"])).toEqual(["a", "c"]);
  });

  it("lists each friend once", () => {
    expect(pickableFriends(["a", "a", "b"], [])).toEqual(["a", "b"]);
  });
});

describe("toggleFriend", () => {
  it("ticks and unticks", () => {
    expect(toggleFriend([], "a", 3)).toEqual(["a"]);
    expect(toggleFriend(["a", "b"], "a", 3)).toEqual(["b"]);
  });

  it("won't tick past the spots left, but always unticks", () => {
    expect(toggleFriend(["a", "b"], "c", 2)).toEqual(["a", "b"]);
    expect(toggleFriend(["a", "b"], "b", 2)).toEqual(["a"]);
  });
});
