import { describe, it, expect, beforeEach, afterEach, vi } from "vite-plus/test";
import { act } from "react";
import { createRoot, Root } from "react-dom/client";

const toggleReactionFn = vi.fn(async () => {});
const showToast = vi.fn();

vi.mock("@/contexts", () => ({
  useCurrentUser: () => ({ user: { id: "u1", userId: "auth1" } }),
}));
vi.mock("@/hooks/useLogPostQuery", () => ({
  useLogPostQuery: () => ({ toggleReactionFn }),
}));
vi.mock("@/hooks/useToastContext", () => ({
  useToastContext: () => ({ showToast }),
}));
vi.mock("@/hooks/useReadTracking", () => ({
  useReadTracking: () => ({ trackUserAction: vi.fn() }),
}));
// The picker itself is lazy-loaded third-party UI; these tests cover the chips.
vi.mock("@/features/moneylog/components/LogPosts/EmojiPickerPanel", () => ({
  default: () => null,
}));

import PostReactions from "@/features/moneylog/components/LogPosts/PostReactions";
import { MemberNamesContext } from "@/features/moneylog/components/LogPosts/memberNames";
import type { LogPost } from "@/types/user";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const post = (reactions?: Record<string, string[]>) => ({ id: "p1", reactions }) as LogPost;
const names = new Map([
  ["u1", "me"],
  ["u2", "ben"],
]);

describe("PostReactions", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    toggleReactionFn.mockClear();
    showToast.mockClear();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  const render = (p: LogPost, canReact: boolean) =>
    act(() =>
      root.render(
        <MemberNamesContext.Provider value={names}>
          <PostReactions post={p} canReact={canReact} />
        </MemberNamesContext.Provider>,
      ),
    );
  const chips = () =>
    Array.from(container.querySelectorAll<HTMLButtonElement>(".PostReactions__chip"));
  const addButton = () => container.querySelector(".PostReactions__add");

  it("renders nothing when there are no reactions and the viewer can't react", () => {
    render(post(), false);
    expect(container.innerHTML).toBe("");
  });

  it("offers the add button to members of a writable log", () => {
    render(post(), true);
    expect(addButton()).not.toBeNull();
  });

  it("shows static chips with no add button on read-only logs or to spectators", () => {
    render(post({ u2: ["🔥"] }), false);
    expect(addButton()).toBeNull();
    expect(chips()).toHaveLength(1);
    expect(chips()[0].disabled).toBe(true);
    expect(chips()[0].title).toBe("ben");
  });

  it("tallies chips and marks the viewer's own", () => {
    render(post({ u1: ["🔥"], u2: ["🔥", "👍"] }), true);
    expect(chips().map((c) => c.textContent)).toEqual(["🔥2", "👍1"]);
    expect(chips()[0].classList.contains("PostReactions__chip--mine")).toBe(true);
    expect(chips()[0].title).toBe("you and ben");
    expect(chips()[1].classList.contains("PostReactions__chip--mine")).toBe(false);
  });

  it("toggles off your own reaction and adds one you haven't left", async () => {
    render(post({ u1: ["🔥"], u2: ["🔥", "👍"] }), true);

    await act(async () => chips()[0].click());
    expect(toggleReactionFn).toHaveBeenLastCalledWith({
      logPostId: "p1",
      userDocId: "u1",
      emoji: "🔥",
      add: false,
    });

    await act(async () => chips()[1].click());
    expect(toggleReactionFn).toHaveBeenLastCalledWith({
      logPostId: "p1",
      userDocId: "u1",
      emoji: "👍",
      add: true,
    });
  });

  it("tells the user when a write fails", async () => {
    toggleReactionFn.mockRejectedValueOnce(new Error("offline"));
    vi.spyOn(console, "error").mockImplementation(() => {});
    render(post({ u2: ["👍"] }), true);
    await act(async () => chips()[0].click());
    expect(showToast).toHaveBeenCalled();
  });
});
