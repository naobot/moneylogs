import { describe, it, expect } from "vite-plus/test";
import {
  buildCommentNotification,
  buildReactionNotification,
  chunk,
  commentNotificationId,
  diffReactions,
  emojiKey,
  notificationRecipients,
  postAuthorRecipients,
  reactionNotificationId,
  recipientReason,
  stripMarkdownExcerpt,
} from "./notifications";

const ref = (id: string) => ({ id });
const post = {
  author: ref("author"),
  group: ref("g1"),
  groupName: "Tokyo trip",
  commentSubscribers: [ref("author"), ref("sub1"), ref("sub2")],
};

describe("notificationRecipients", () => {
  it("is the author plus subscribers, de-duplicated, minus the actor", () => {
    expect(notificationRecipients(post, "sub1")).toEqual(["author", "sub2"]);
    expect(notificationRecipients(post, "author")).toEqual(["sub1", "sub2"]);
    expect(notificationRecipients(post, "stranger")).toEqual(["author", "sub1", "sub2"]);
  });

  it("tolerates missing or malformed fields", () => {
    expect(notificationRecipients({}, "x")).toEqual([]);
    expect(
      notificationRecipients({ author: null, commentSubscribers: [null, {}, ref("a")] }, "x"),
    ).toEqual(["a"]);
  });
});

describe("postAuthorRecipients", () => {
  it("is just the author, never the actor", () => {
    expect(postAuthorRecipients(post, "sub1")).toEqual(["author"]);
    expect(postAuthorRecipients(post, "author")).toEqual([]);
    expect(postAuthorRecipients({}, "x")).toEqual([]);
  });
});

describe("recipientReason", () => {
  it("tells the author apart from subscribers", () => {
    expect(recipientReason(post, "author")).toBe("author");
    expect(recipientReason(post, "sub1")).toBe("subscriber");
  });
});

describe("diffReactions", () => {
  it("finds added and removed (user, emoji) pairs", () => {
    expect(
      diffReactions({ u1: ["👍", "🔥"], u2: ["😂"] }, { u1: ["🔥", "👀"], u3: ["👍"] }),
    ).toEqual({
      added: [
        { userId: "u1", emoji: "👀" },
        { userId: "u3", emoji: "👍" },
      ],
      removed: [
        { userId: "u1", emoji: "👍" },
        { userId: "u2", emoji: "😂" },
      ],
    });
  });

  it("reports nothing for unchanged or absent reactions", () => {
    expect(diffReactions(undefined, undefined)).toEqual({ added: [], removed: [] });
    expect(diffReactions({ u1: ["👍"] }, { u1: ["👍"] })).toEqual({ added: [], removed: [] });
  });

  it("ignores non-string junk", () => {
    expect(diffReactions({}, { u1: ["👍", 3, null], u2: "nope" })).toEqual({
      added: [{ userId: "u1", emoji: "👍" }],
      removed: [],
    });
  });
});

describe("notification ids", () => {
  it("encodes emoji as code points so ids are stable and path-safe", () => {
    expect(emojiKey("👍")).toBe("1f44d");
    expect(emojiKey("👍🏽")).toBe("1f44d-1f3fd");
    expect(reactionNotificationId("p1", "u1", "🔥")).toBe("reaction_p1_u1_1f525");
    expect(reactionNotificationId("p1", "u1", "🔥")).not.toBe(
      reactionNotificationId("p1", "u1", "👍"),
    );
    expect(commentNotificationId("c9")).toBe("comment_c9");
  });
});

describe("stripMarkdownExcerpt", () => {
  it("reduces markdown to a short plain line", () => {
    expect(
      stripMarkdownExcerpt("## Wow\n\n**that** _ramen_ looks [amazing](https://x.y) ![img](a.png)"),
    ).toBe("Wow that ramen looks amazing");
    expect(stripMarkdownExcerpt("- one\n- two\n> quoted `code`")).toBe("one two quoted code");
  });

  it("truncates with an ellipsis", () => {
    const out = stripMarkdownExcerpt("word ".repeat(50), 20);
    expect(out.length).toBeLessThanOrEqual(20);
    expect(out.endsWith("…")).toBe(true);
  });

  it("handles non-strings", () => {
    expect(stripMarkdownExcerpt(undefined)).toBe("");
  });
});

describe("builders", () => {
  it("builds a comment notification", () => {
    expect(
      buildCommentNotification({
        post,
        postId: "p1",
        commentId: "c1",
        actorId: "sub1",
        actorName: "Ben",
        content: "**nice**",
      }),
    ).toEqual({
      type: "comment",
      logKind: "social",
      postId: "p1",
      groupId: "g1",
      groupName: "Tokyo trip",
      actorId: "sub1",
      actorName: "Ben",
      commentId: "c1",
      excerpt: "nice",
    });
  });

  it("builds a reaction notification", () => {
    expect(
      buildReactionNotification({
        post: {},
        postId: "p1",
        actorId: "u1",
        actorName: "Ana",
        emoji: "🔥",
      }),
    ).toEqual({
      type: "reaction",
      logKind: "social",
      postId: "p1",
      groupId: "",
      groupName: "",
      actorId: "u1",
      actorName: "Ana",
      emoji: "🔥",
    });
  });
});

describe("chunk", () => {
  it("splits into batch-sized groups", () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
    expect(chunk([])).toEqual([]);
  });
});
