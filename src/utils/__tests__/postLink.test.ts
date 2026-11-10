import { describe, it, expect } from "vite-plus/test";
import { postLinkHref, readPostLink, resolvePostLink, withoutPostLink } from "@/utils/postLink";

describe("postLinkHref / readPostLink", () => {
  it("round-trips a post link, with and without a comment", () => {
    const post = postLinkHref("g1", "p1");
    expect(post).toBe("/g/g1?post=p1");
    expect(readPostLink(new URL(post, "https://x").searchParams)).toEqual({ postId: "p1" });

    const comment = postLinkHref("g1", "p1", "c1");
    expect(comment).toBe("/g/g1?post=p1&comment=c1");
    expect(readPostLink(new URL(comment, "https://x").searchParams)).toEqual({
      postId: "p1",
      commentId: "c1",
    });
  });

  it("encodes ids", () => {
    expect(postLinkHref("g1", "a&b")).toBe("/g/g1?post=a%26b");
  });

  it("reads nothing without a post id", () => {
    expect(readPostLink(new URLSearchParams("comment=c1"))).toBeNull();
    expect(readPostLink(new URLSearchParams(""))).toBeNull();
  });

  it("drops only the link params", () => {
    const kept = withoutPostLink(new URLSearchParams("post=p1&comment=c1&other=1"));
    expect(kept.toString()).toBe("other=1");
  });
});

describe("resolvePostLink", () => {
  const posts = [{ id: "p1" }, { id: "p2" }];
  const idle = { hasMore: false, isLoadingMore: false };

  it("finds a loaded post", () => {
    expect(resolvePostLink(posts, "p2", idle)).toEqual({ status: "found", post: { id: "p2" } });
  });

  it("asks for another page while older posts exist", () => {
    expect(resolvePostLink(posts, "old", { hasMore: true, isLoadingMore: false })).toEqual({
      status: "load-more",
    });
  });

  it("waits while a page is in flight", () => {
    expect(resolvePostLink(posts, "old", { hasMore: true, isLoadingMore: true })).toEqual({
      status: "waiting",
    });
  });

  it("gives up once everything is loaded", () => {
    expect(resolvePostLink(posts, "gone", idle)).toEqual({ status: "missing" });
  });
});
