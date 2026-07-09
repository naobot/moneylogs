import { describe, it, expect } from "vite-plus/test";
import { shouldShowCommentBadge, shouldShowPostBell } from "../navBadges";

const base = {
  isSpectator: false,
  isOwnItem: false,
  isViewingThisMember: false,
  memberHasUnreadPosts: false,
  hasUnreadComments: false,
};

describe("shouldShowCommentBadge", () => {
  it("shows on your OWN item in the digest when there are unseen comments (the reported bug)", () => {
    // isOwnItem true, not viewing (digest), no unread posts, has unread comments
    expect(shouldShowCommentBadge({ ...base, isOwnItem: true, hasUnreadComments: true })).toBe(
      true,
    );
  });

  it("is hidden while actively viewing that member's log", () => {
    expect(
      shouldShowCommentBadge({
        ...base,
        isOwnItem: true,
        isViewingThisMember: true,
        hasUnreadComments: true,
      }),
    ).toBe(false);
  });

  it("is hidden for spectators", () => {
    expect(shouldShowCommentBadge({ ...base, isSpectator: true, hasUnreadComments: true })).toBe(
      false,
    );
  });

  it("yields to the post bell for another member with unread posts", () => {
    expect(
      shouldShowCommentBadge({ ...base, memberHasUnreadPosts: true, hasUnreadComments: true }),
    ).toBe(false);
  });

  it("shows for another member with unread comments but no unread posts", () => {
    expect(shouldShowCommentBadge({ ...base, hasUnreadComments: true })).toBe(true);
  });

  it("is hidden when there are no unseen comments", () => {
    expect(shouldShowCommentBadge({ ...base, hasUnreadComments: false })).toBe(false);
  });
});

describe("shouldShowPostBell", () => {
  it("shows for another member's unseen posts", () => {
    expect(shouldShowPostBell({ ...base, memberHasUnreadPosts: true })).toBe(true);
  });

  it("never shows for your own item", () => {
    expect(shouldShowPostBell({ ...base, isOwnItem: true, memberHasUnreadPosts: true })).toBe(
      false,
    );
  });

  it("is hidden while actively viewing that member's log", () => {
    expect(
      shouldShowPostBell({ ...base, isViewingThisMember: true, memberHasUnreadPosts: true }),
    ).toBe(false);
  });

  it("is hidden for spectators", () => {
    expect(shouldShowPostBell({ ...base, isSpectator: true, memberHasUnreadPosts: true })).toBe(
      false,
    );
  });
});
