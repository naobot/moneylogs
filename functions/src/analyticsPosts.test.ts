import { describe, expect, it } from "vite-plus/test";
import { isValidTimeZone, isWellFormedPost, postsForAnalytics } from "./analyticsPosts";
import { absoluteEndMs } from "./logTimeline";

// authorId null: no author at all.
const post = (id: string, seconds: number | undefined, authorId: string | null = "u1") => ({
  id,
  author: authorId === null ? undefined : { id: authorId },
  postDate: seconds === undefined ? undefined : { seconds },
});

describe("isWellFormedPost", () => {
  it("accepts a post with an author and a postDate", () => {
    expect(isWellFormedPost(post("a", 100))).toBe(true);
  });

  it("rejects a post without an author or author id", () => {
    expect(isWellFormedPost(post("a", 100, null))).toBe(false);
    expect(isWellFormedPost(post("a", 100, ""))).toBe(false);
    expect(isWellFormedPost({ author: null, postDate: { seconds: 100 } })).toBe(false);
  });

  it("rejects a post without a numeric postDate", () => {
    expect(isWellFormedPost(post("a", undefined))).toBe(false);
    expect(isWellFormedPost({ author: { id: "u1" }, postDate: { seconds: "100" } })).toBe(false);
  });
});

describe("postsForAnalytics", () => {
  it("drops malformed posts and posts after the cutoff, keeping the cutoff itself", () => {
    const posts = [post("ok", 100), post("edge", 200), post("late", 201), post("anon", 50, null)];
    expect(postsForAnalytics(posts, 200_000).map((p) => p.id)).toEqual(["ok", "edge"]);
  });

  it("counts a late-timezone entry of a wall-clock log when cut at the absolute end", () => {
    // A log ending 2026-11-20T23:59 wall-clock, created in Tokyo: the stored `end` is the
    // Tokyo instant, but a UTC-12 member can post until 23:59 at UTC-12, 21 hours later.
    const endMs = Date.UTC(2026, 10, 20, 14, 59); // 23:59 in Tokyo
    const group = { id: "g", title: "t", endWallClock: "2026-11-20T23:59", endMs };
    const lateEntry = post("late-tz", Date.UTC(2026, 10, 21, 10, 0) / 1000); // 22:00 at UTC-12

    expect(postsForAnalytics([lateEntry], endMs)).toEqual([]);
    expect(postsForAnalytics([lateEntry], absoluteEndMs(group)).map((p) => p.id)).toEqual([
      "late-tz",
    ]);
  });
});

describe("isValidTimeZone", () => {
  it("accepts IANA zones and rejects anything else", () => {
    expect(isValidTimeZone("America/Toronto")).toBe(true);
    expect(isValidTimeZone("Mars/Olympus_Mons")).toBe(false);
    expect(isValidTimeZone("")).toBe(false);
    expect(isValidTimeZone(undefined)).toBe(false);
  });
});
