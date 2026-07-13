import { describe, it, expect } from "vite-plus/test";
import { selectHotPosts } from "@/features/moneylog/components/LogsSummary/HotPosts";
import type { LogPost } from "@/types/user";

// Only commentCount and id matter to the selection logic.
const post = (id: string, commentCount: number): LogPost =>
  ({ id, commentCount }) as unknown as LogPost;

describe("selectHotPosts", () => {
  it("shows nothing for a low-activity group whose busiest post is below the floor", () => {
    // The reported bug: max comment count of 2 previously matched every post
    // (including zero-comment ones) because the threshold floored at 0.
    const posts = [post("a", 2), post("b", 2), post("c", 1), post("d", 0)];
    expect(selectHotPosts(posts)).toEqual([]);
  });

  it("never includes zero-comment posts", () => {
    const posts = [post("a", 4), post("b", 0), post("c", 0)];
    const hot = selectHotPosts(posts);
    expect(hot.map((p) => p.id)).toEqual(["a"]);
  });

  it("surfaces a genuine standout in an otherwise quiet group", () => {
    const posts = [post("standout", 4), post("b", 1), post("c", 0), post("d", 3)];
    const hot = selectHotPosts(posts);
    // Both posts clear the floor of 3 and fall within the band of the max (4).
    expect(hot.map((p) => p.id)).toEqual(["standout", "d"]);
  });

  it("keeps the near-max band for active groups and sorts by comment count", () => {
    const posts = [post("a", 20), post("b", 16), post("c", 15), post("d", 14), post("e", 3)];
    const hot = selectHotPosts(posts);
    // Within 5 of the max (>= 15); the 14- and 3-comment posts fall outside.
    expect(hot.map((p) => p.id)).toEqual(["a", "b", "c"]);
  });

  it("caps the result at the top 10 posts", () => {
    // 12 posts all tied near a high max — only the top 10 should show.
    const posts = Array.from({ length: 12 }, (_, i) => post(`p${i}`, 30));
    expect(selectHotPosts(posts)).toHaveLength(10);
  });

  it("returns an empty array when there are no posts", () => {
    expect(selectHotPosts([])).toEqual([]);
  });
});
