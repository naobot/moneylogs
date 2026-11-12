import { describe, it, expect } from "vite-plus/test";
import {
  DELETED_USER_NAME,
  isRecentSignIn,
  planLedgerExit,
  planPostCleanup,
  planSocialExit,
} from "./deleteAccountPlan";

const ref = (id: string) => ({ id });
const me = new Set(["meDoc"]);

describe("isRecentSignIn", () => {
  const now = 1_000_000;

  it("accepts a sign-in within the last five minutes", () => {
    expect(isRecentSignIn(now, now)).toBe(true);
    expect(isRecentSignIn(now - 299, now)).toBe(true);
  });

  it("rejects older sign-ins and missing values", () => {
    expect(isRecentSignIn(now - 301, now)).toBe(false);
    expect(isRecentSignIn(undefined, now)).toBe(false);
    expect(isRecentSignIn("1000000", now)).toBe(false);
  });

  it("rejects times well in the future", () => {
    expect(isRecentSignIn(now + 3600, now)).toBe(false);
  });
});

describe("planSocialExit", () => {
  it("deletes a log the person is alone in", () => {
    expect(planSocialExit({ members: [ref("meDoc")] }, "me", me)).toEqual({ action: "purge" });
  });

  it("deletes a log they created that nobody else is in", () => {
    expect(planSocialExit({ members: [], createdBy: "me" }, "me", me)).toEqual({
      action: "purge",
    });
  });

  it("leaves a shared log and passes on creatorship", () => {
    expect(
      planSocialExit({ members: [ref("meDoc"), ref("a"), ref("b")], createdBy: "me" }, "me", me),
    ).toEqual({ action: "leave", remainingMemberIds: ["a", "b"], transferCreator: true });
  });

  it("leaves a shared log someone else created without touching creatorship", () => {
    expect(
      planSocialExit({ members: [ref("a"), ref("meDoc")], createdBy: "other" }, "me", me),
    ).toEqual({ action: "leave", remainingMemberIds: ["a"], transferCreator: false });
  });

  it("never deletes an empty log the person isn't part of", () => {
    expect(planSocialExit({ members: [], createdBy: "other" }, "me", me)).toEqual({
      action: "skip",
    });
  });
});

describe("planLedgerExit", () => {
  it("deletes a solo ledger such as the personal log", () => {
    expect(planLedgerExit({ members: [ref("meDoc")], memberUids: ["me"] }, "me", me)).toEqual({
      action: "purge",
    });
  });

  it("removes the person from both aligned arrays", () => {
    const a = ref("a");
    const b = ref("b");
    expect(
      planLedgerExit({ members: [a, ref("meDoc"), b], memberUids: ["ua", "me", "ub"] }, "me", me),
    ).toEqual({ action: "leave", members: [a, b], memberUids: ["ua", "ub"] });
  });

  it("passes on an explicit creatorship to the next member", () => {
    const a = ref("a");
    expect(
      planLedgerExit(
        { members: [ref("meDoc"), a], memberUids: ["me", "ua"], createdBy: "me" },
        "me",
        me,
      ),
    ).toEqual({ action: "leave", members: [a], memberUids: ["ua"], createdBy: "ua" });
  });

  it("skips ledgers the person isn't in", () => {
    expect(planLedgerExit({ members: [ref("a")], memberUids: ["ua"] }, "me", me)).toEqual({
      action: "skip",
    });
  });
});

describe("planPostCleanup", () => {
  it("finds the person's reactions, subscription and authorship", () => {
    expect(
      planPostCleanup(
        {
          author: ref("meDoc"),
          reactions: { meDoc: ["🔥"], a: ["👍"] },
          commentSubscribers: [ref("a"), ref("meDoc")],
        },
        me,
      ),
    ).toEqual({ reactionKeys: ["meDoc"], unsubscribe: true, isAuthor: true });
  });

  it("returns null for posts that don't involve them", () => {
    expect(
      planPostCleanup(
        { author: ref("a"), reactions: { a: ["👍"] }, commentSubscribers: [ref("a")] },
        me,
      ),
    ).toBeNull();
  });

  it("doesn't re-anonymise a post on a retry", () => {
    expect(planPostCleanup({ author: ref("meDoc"), authorName: DELETED_USER_NAME }, me)).toBeNull();
  });
});
