import { describe, it, expect, vi } from "vite-plus/test";
import { arePostItemPropsEqual } from "../LogPosts";
import type { LogPost } from "@/types/user";

// The comparator only inspects a handful of fields; build a minimal props object and
// cast, overriding per-case. Two distinct post objects with fixed ids stand in for the
// list's stable Firestore snapshots.
const postA = { id: "a" } as LogPost;
const postB = { id: "b" } as LogPost;

const baseProps = () =>
  ({
    user: { id: "u1" },
    groupId: "g1",
    post: postA,
    selectedPostId: null,
    setSelectedPost: vi.fn(),
    setCurrentlyEditingPostId: vi.fn(),
    onOpenComments: vi.fn(),
    isMyLog: false,
    isDigestMode: false,
    isReadOnly: false,
    isPostingClosed: false,
    isSummaryView: false,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  }) as any;

describe("arePostItemPropsEqual", () => {
  it("skips re-render when nothing this item shows has changed", () => {
    const prev = baseProps();
    expect(arePostItemPropsEqual(prev, { ...prev })).toBe(true);
  });

  it("skips re-render when the selection moves between two other posts", () => {
    // This item is postA; selection shifts from postB to a third post — neither is us.
    const prev = { ...baseProps(), selectedPostId: "b" };
    expect(arePostItemPropsEqual(prev, { ...prev, selectedPostId: "c" })).toBe(true);
  });

  it("re-renders when this item becomes selected", () => {
    const prev = { ...baseProps(), selectedPostId: null };
    expect(arePostItemPropsEqual(prev, { ...prev, selectedPostId: "a" })).toBe(false);
  });

  it("re-renders when this item becomes deselected", () => {
    const prev = { ...baseProps(), selectedPostId: "a" };
    expect(arePostItemPropsEqual(prev, { ...prev, selectedPostId: null })).toBe(false);
  });

  it("re-renders when the post itself changes (new snapshot)", () => {
    const prev = baseProps();
    expect(arePostItemPropsEqual(prev, { ...prev, post: postB })).toBe(false);
  });

  it("re-renders when a display flag changes", () => {
    const prev = baseProps();
    expect(arePostItemPropsEqual(prev, { ...prev, isReadOnly: true })).toBe(false);
  });

  it("re-renders when a callback identity changes (guards against stale closures)", () => {
    const prev = baseProps();
    expect(arePostItemPropsEqual(prev, { ...prev, onOpenComments: vi.fn() })).toBe(false);
  });
});
