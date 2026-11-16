import { describe, it, expect } from "vite-plus/test";
import { friendsHint } from "../friendsHint";

describe("friendsHint", () => {
  it("counts friends, and requests when there are any", () => {
    expect(friendsHint({ friends: 0, incoming: 0 })).toBe("0 friends");
    expect(friendsHint({ friends: 1, incoming: 0 })).toBe("1 friend");
    expect(friendsHint({ friends: 3, incoming: 1 })).toBe("3 friends · 1 request");
    expect(friendsHint({ friends: 2, incoming: 4 })).toBe("2 friends · 4 requests");
  });
});
