import { describe, it, expect } from "vite-plus/test";
import {
  logInviteNotificationId,
  MAX_INVITES_PER_CALL,
  memberIdsOf,
  parseInviteRequest,
  planInvites,
} from "./logInvitesPlan";
import { logInviteNotificationId as clientNotificationId } from "../../src/features/invites/logInvites";

describe("parseInviteRequest", () => {
  it("accepts a well-formed request and de-duplicates friends", () => {
    expect(
      parseInviteRequest({ logId: "log1", logKind: "social", friendIds: ["a", "b", "a"] }),
    ).toEqual({ logId: "log1", logKind: "social", friendIds: ["a", "b"] });
    expect(parseInviteRequest({ logId: "l", logKind: "ledger", friendIds: ["a"] })?.logKind).toBe(
      "ledger",
    );
  });

  it.each([
    ["nothing", undefined],
    ["no friends", { logId: "l", logKind: "social", friendIds: [] }],
    ["unknown kind", { logId: "l", logKind: "personal", friendIds: ["a"] }],
    ["bad log id", { logId: "a/b", logKind: "social", friendIds: ["a"] }],
    ["bad friend id", { logId: "l", logKind: "social", friendIds: ["a", "../x"] }],
    ["non-string friend", { logId: "l", logKind: "social", friendIds: [3] }],
    [
      "too many friends",
      {
        logId: "l",
        logKind: "social",
        friendIds: Array.from({ length: MAX_INVITES_PER_CALL + 1 }, (_, i) => `f${i}`),
      },
    ],
  ])("rejects %s", (_, data) => {
    expect(parseInviteRequest(data)).toBeNull();
  });
});

describe("planInvites", () => {
  const base = {
    inviterId: "me",
    memberIds: ["me", "inLog"],
    acceptedFriendIds: new Set(["f1", "f2", "inLog"]),
  };

  it("invites accepted friends who aren't in the log", () => {
    expect(planInvites({ ...base, friendIds: ["f1", "f2"] })).toEqual({
      invite: ["f1", "f2"],
      skipped: [],
    });
  });

  it("skips yourself, members, and people who aren't (yet) your friends", () => {
    expect(planInvites({ ...base, friendIds: ["me", "inLog", "stranger", "f1"] })).toEqual({
      invite: ["f1"],
      skipped: [
        { id: "me", reason: "self" },
        { id: "inLog", reason: "member" },
        { id: "stranger", reason: "not_friends" },
      ],
    });
  });
});

describe("memberIdsOf", () => {
  it("reads doc ids from a members array of references", () => {
    expect(memberIdsOf([{ id: "a" }, { id: "b" }])).toEqual(["a", "b"]);
  });

  it("tolerates missing or odd data", () => {
    expect(memberIdsOf(undefined)).toEqual([]);
    expect(memberIdsOf([null, { id: "" }, "x", { id: "c" }])).toEqual(["c"]);
  });
});

describe("logInviteNotificationId", () => {
  it("is one id per log, the same the client clears on joining", () => {
    expect(logInviteNotificationId("log1")).toBe("log_invite_log1");
    expect(clientNotificationId("log1")).toBe(logInviteNotificationId("log1"));
  });
});
