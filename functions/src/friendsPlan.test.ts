import { describe, it, expect } from "vite-plus/test";
import {
  friendState,
  pairId,
  parseFriendRequest,
  planRemove,
  planRequest,
  planRespond,
} from "./friendsPlan";
import * as client from "../../src/utils/friends";

describe("pairId", () => {
  it("is the same either way round and matches the client", () => {
    expect(pairId("b", "a")).toBe("a__b");
    expect(pairId("a", "b")).toBe("a__b");
    expect(client.pairId("b", "a")).toBe(pairId("b", "a"));
  });
});

describe("friendState", () => {
  it("reads the pair from one side", () => {
    expect(friendState(undefined, "me")).toBe("none");
    expect(friendState({ requester: "me", status: "pending" }, "me")).toBe("outgoing");
    expect(friendState({ requester: "them", status: "pending" }, "me")).toBe("incoming");
    expect(friendState({ requester: "them", status: "accepted" }, "me")).toBe("friends");
  });

  it("agrees with the client", () => {
    for (const f of [
      undefined,
      { requester: "me", status: "pending" as const },
      { requester: "x", status: "pending" as const },
      { requester: "x", status: "accepted" as const },
    ]) {
      expect(client.friendState(f, "me")).toBe(friendState(f, "me"));
    }
  });
});

describe("parseFriendRequest", () => {
  it("accepts a doc id, with an optional accept flag", () => {
    expect(parseFriendRequest({ otherUserDocId: "abc_DEF-1" })).toEqual({
      otherUserDocId: "abc_DEF-1",
    });
    expect(parseFriendRequest({ otherUserDocId: "abc", accept: false })).toEqual({
      otherUserDocId: "abc",
      accept: false,
    });
  });

  it("rejects anything else", () => {
    for (const bad of [
      null,
      "abc",
      {},
      { otherUserDocId: "" },
      { otherUserDocId: "a/b" },
      { otherUserDocId: 5 },
      { otherUserDocId: "abc", accept: "yes" },
    ]) {
      expect(parseFriendRequest(bad)).toBeNull();
    }
  });
});

describe("plans", () => {
  it("requesting starts, or accepts a request coming the other way", () => {
    expect(planRequest("none")).toBe("create");
    expect(planRequest("incoming")).toBe("accept");
    expect(planRequest("outgoing")).toBe("noop");
    expect(planRequest("friends")).toBe("noop");
  });

  it("only incoming requests can be answered", () => {
    expect(planRespond("incoming", true)).toBe("accept");
    expect(planRespond("incoming", false)).toBe("delete");
    expect(planRespond("outgoing", true)).toBe("invalid");
    expect(planRespond("none", false)).toBe("invalid");
    expect(planRespond("friends", true)).toBe("invalid");
  });

  it("removing deletes whatever is there", () => {
    expect(planRemove("none")).toBe("noop");
    expect(planRemove("outgoing")).toBe("delete");
    expect(planRemove("incoming")).toBe("delete");
    expect(planRemove("friends")).toBe("delete");
  });
});
