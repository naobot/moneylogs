import { describe, it, expect } from "vite-plus/test";
import {
  memberHasUnreadPosts,
  commentsAreUnseen,
  isSubscribedToComments,
  postHasUnreadComments,
} from "@/utils/unread";

const GROUP = "group1";
const ts = (seconds: number) => ({ seconds });

describe("memberHasUnreadPosts", () => {
  const base = { member: { id: "m1", lastUpdated: { [GROUP]: ts(100) } }, groupId: GROUP };

  it("is false when the member is missing", () => {
    expect(memberHasUnreadPosts({ member: undefined, viewTracking: {}, groupId: GROUP })).toBe(
      false,
    );
  });

  it("is false when the member has never posted in this group", () => {
    expect(
      memberHasUnreadPosts({
        member: { id: "m1", lastUpdated: {} },
        viewTracking: {},
        groupId: GROUP,
      }),
    ).toBe(false);
  });

  it("is true when the member posted but the user has never viewed them", () => {
    expect(memberHasUnreadPosts({ ...base, viewTracking: {} })).toBe(true);
    expect(memberHasUnreadPosts({ ...base, viewTracking: undefined })).toBe(true);
  });

  it("is true when the member's latest post is newer than the last view", () => {
    const viewTracking = { [GROUP]: { m1: { lastViewedAt: ts(50) } } };
    expect(memberHasUnreadPosts({ ...base, viewTracking })).toBe(true);
  });

  it("is false when the last view is at or after the latest post", () => {
    expect(
      memberHasUnreadPosts({
        ...base,
        viewTracking: { [GROUP]: { m1: { lastViewedAt: ts(100) } } },
      }),
    ).toBe(false);
    expect(
      memberHasUnreadPosts({
        ...base,
        viewTracking: { [GROUP]: { m1: { lastViewedAt: ts(150) } } },
      }),
    ).toBe(false);
  });
});

describe("commentsAreUnseen", () => {
  const post = { id: "p1", latestCommentAt: ts(100) };

  it("is false when the post has no comment activity", () => {
    expect(commentsAreUnseen(undefined, {})).toBe(false);
    expect(commentsAreUnseen({ id: "p1" }, {})).toBe(false);
  });

  it("is true when there is comment activity the user has never viewed", () => {
    expect(commentsAreUnseen(post, {})).toBe(true);
    expect(commentsAreUnseen(post, undefined)).toBe(true);
  });

  it("is true when the latest comment is newer than the last view", () => {
    expect(commentsAreUnseen(post, { p1: { lastViewedAt: ts(50) } })).toBe(true);
  });

  it("is false when the last view is at or after the latest comment", () => {
    expect(commentsAreUnseen(post, { p1: { lastViewedAt: ts(100) } })).toBe(false);
    expect(commentsAreUnseen(post, { p1: { lastViewedAt: ts(150) } })).toBe(false);
  });
});

describe("isSubscribedToComments", () => {
  it("is false without subscribers or a user id", () => {
    expect(isSubscribedToComments({ id: "p1" }, "u1")).toBe(false);
    expect(
      isSubscribedToComments({ id: "p1", commentSubscribers: [{ id: "u1" }] }, undefined),
    ).toBe(false);
  });

  it("reflects membership in the subscriber list", () => {
    const post = { id: "p1", commentSubscribers: [{ id: "u1" }, { id: "u2" }] };
    expect(isSubscribedToComments(post, "u1")).toBe(true);
    expect(isSubscribedToComments(post, "u3")).toBe(false);
  });
});

describe("postHasUnreadComments", () => {
  const subscribedPost = {
    id: "p1",
    latestCommentAt: ts(100),
    commentSubscribers: [{ id: "u1" }],
  };

  it("is false without a user", () => {
    expect(postHasUnreadComments(subscribedPost, undefined)).toBe(false);
  });

  it("is false when the user is not subscribed", () => {
    const user = { id: "u2", commentSubscriptions: {} };
    expect(postHasUnreadComments(subscribedPost, user)).toBe(false);
  });

  it("is true when subscribed with unseen comments", () => {
    const user = { id: "u1", commentSubscriptions: {} };
    expect(postHasUnreadComments(subscribedPost, user)).toBe(true);
  });

  it("is false when subscribed but already caught up", () => {
    const user = { id: "u1", commentSubscriptions: { p1: { lastViewedAt: ts(100) } } };
    expect(postHasUnreadComments(subscribedPost, user)).toBe(false);
  });

  it("surfaces unread comments on your own post (author is auto-subscribed)", () => {
    // The current user authored p1 and is therefore in commentSubscribers; a newer
    // comment they haven't seen must count as unread on their own log.
    const ownPost = { id: "p1", latestCommentAt: ts(200), commentSubscribers: [{ id: "me" }] };
    const user = { id: "me", commentSubscriptions: { p1: { lastViewedAt: ts(100) } } };
    expect(postHasUnreadComments(ownPost, user)).toBe(true);
  });
});
