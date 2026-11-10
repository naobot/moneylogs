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
// The full palette is lazy-loaded third-party UI; these tests cover our own parts.
vi.mock("@/features/moneylog/components/LogPosts/EmojiPickerPanel", () => ({
  default: () => <div className="EmojiPickerStub" />,
}));

// Record where each panel is asked to open, while still rendering the real Popover.
const placements = new Map<string, string | undefined>();
vi.mock("@/components/Popover", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/components/Popover")>();
  const Recording = (props: Parameters<typeof actual.default>[0]) => {
    if (props.open && props.className) placements.set(props.className, props.placement);
    return actual.default(props);
  };
  return { ...actual, default: Recording, Popover: Recording };
});

import PostReactions from "@/features/moneylog/components/LogPosts/PostReactions";
import { MemberNamesContext } from "@/features/moneylog/components/LogPosts/memberNames";
import type { LogPost } from "@/types/user";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const post = (reactions?: Record<string, string[]>) => ({ id: "p1", reactions }) as LogPost;
const names = new Map([
  ["u1", "me"],
  ["u2", "ben"],
  ["u3", "cy"],
]);

describe("PostReactions", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    placements.clear();
    toggleReactionFn.mockClear();
    showToast.mockClear();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.useRealTimers();
  });

  const render = (p: LogPost, canReact: boolean, isFirst = false) =>
    act(() =>
      root.render(
        <MemberNamesContext.Provider value={names}>
          <PostReactions post={p} canReact={canReact} isFirst={isFirst} />
        </MemberNamesContext.Provider>,
      ),
    );
  const hover = (el: Element) =>
    act(() => {
      el.dispatchEvent(new PointerEvent("pointerover", { bubbles: true, pointerType: "mouse" }));
    });
  const wait = (ms: number) => act(() => vi.advanceTimersByTime(ms));
  const tallies = () => Array.from(container.querySelectorAll(".PostReactions__tally"));
  const applied = () => container.querySelector<HTMLButtonElement>(".PostReactions__applied");
  const trigger = () => container.querySelector<HTMLButtonElement>(".PostReactions__trigger");
  // Panels are portalled to <body>.
  const panel = (className: string) => document.body.querySelector<HTMLElement>(`.${className}`);

  it("renders nothing when there are no reactions and the viewer can't react", () => {
    render(post(), false);
    expect(container.innerHTML).toBe("");
  });

  it("offers the smiley react button to members of a writable log", () => {
    render(post(), true);
    expect(trigger()?.querySelector("img")?.getAttribute("src")).toBe(
      "/icons/moneylogs-smiley.svg",
    );
    expect(applied()).toBeNull();
  });

  it("shows applied emoji with bare counts, without the react button, when read-only", () => {
    render(post({ u2: ["🔥"], u3: ["🔥", "👍"] }), false);
    expect(trigger()).toBeNull();
    expect(tallies().map((t) => t.textContent)).toEqual(["🔥2", "👍1"]);
  });

  it("shows at most four applied emoji inline and marks the overflow", () => {
    render(post({ u2: ["1", "2", "3", "4", "5", "6"] }), true);
    expect(tallies()).toHaveLength(4);
    expect(container.querySelector(".PostReactions__more")).not.toBeNull();
  });

  it("names who reacted after a short hover over a tally, above the entry", () => {
    vi.useFakeTimers();
    render(post({ u1: ["🔥"], u2: ["🔥"] }), false);
    hover(tallies()[0]);
    wait(100);
    expect(panel("ReactionTooltip")).toBeNull(); // not instantly
    wait(400);
    expect(panel("ReactionTooltip")?.textContent).toBe("🔥 you and ben");
    expect(placements.get("ReactionTooltip")).toBe("top");
  });

  it("opens hover popovers below on the first entry of the page", () => {
    vi.useFakeTimers();
    render(post({ u2: ["🔥"] }), true, true);
    hover(tallies()[0]);
    wait(500);
    expect(placements.get("ReactionTooltip")).toBe("bottom");
  });

  it("opens a details panel listing every reaction and everyone who left it", () => {
    render(post({ u2: ["1", "2", "3", "4", "5"], u3: ["5"] }), false);
    act(() => applied()!.click());
    const items = Array.from(panel("ReactionDetails")!.querySelectorAll("li"));
    expect(items).toHaveLength(5);
    expect(items[0].textContent).toBe("52ben, cy");
    // Read-only: no remove buttons.
    expect(panel("ReactionDetails")!.querySelector("button")).toBeNull();
  });

  it("lets you remove your own reaction from the details panel", async () => {
    render(post({ u1: ["🔥"], u2: ["👍"] }), true);
    act(() => applied()!.click());
    const remove = panel("ReactionDetails")!.querySelector<HTMLButtonElement>(
      ".ReactionDetails__remove",
    )!;
    expect(remove.getAttribute("aria-label")).toBe("Remove your 🔥");
    await act(async () => remove.click());
    expect(toggleReactionFn).toHaveBeenLastCalledWith({
      logPostId: "p1",
      userDocId: "u1",
      emoji: "🔥",
      add: false,
    });
  });

  it("shows the curated row after a short hover over the smiley", () => {
    vi.useFakeTimers();
    render(post(), true);
    hover(trigger()!);
    expect(panel("ReactionQuick")).toBeNull();
    wait(500);
    expect(panel("ReactionQuick")?.querySelectorAll(".ReactionQuick__emoji")).toHaveLength(8);
    expect(placements.get("ReactionQuick")).toBe("top");
  });

  it("doesn't open the curated row if the pointer just passes over", () => {
    vi.useFakeTimers();
    render(post(), true);
    hover(trigger()!);
    act(() => {
      trigger()!.dispatchEvent(
        new PointerEvent("pointerout", { bubbles: true, pointerType: "mouse" }),
      );
    });
    wait(1000);
    expect(panel("ReactionQuick")).toBeNull();
  });

  it("shares the comment bubble's IconText box, with no hover styling of its own", () => {
    render(post(), true);
    expect(trigger()!.classList.contains("IconText")).toBe(true);
    expect(trigger()!.classList.contains("handler")).toBe(true);
  });

  it("opens the full palette as a panel (no backdrop) on clicking the smiley", async () => {
    render(post({ u1: ["👍"] }), true);
    await act(async () => trigger()!.click());
    const picker = panel("ReactionPicker")!;
    expect(picker.getAttribute("role")).toBe("dialog");
    expect(document.body.querySelector(".Modal__backdrop")).toBeNull();

    // The curated row tops the palette; your own picks toggle off, others add.
    const quick = Array.from(picker.querySelectorAll<HTMLButtonElement>(".ReactionQuick__emoji"));
    expect(quick[0].getAttribute("aria-pressed")).toBe("true");
    await act(async () => quick[1].click());
    expect(toggleReactionFn).toHaveBeenLastCalledWith({
      logPostId: "p1",
      userDocId: "u1",
      emoji: "❤️",
      add: true,
    });
    expect(panel("ReactionPicker")).toBeNull();
  });

  it("closes the palette on Escape", async () => {
    render(post(), true);
    await act(async () => trigger()!.click());
    act(() => {
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    });
    expect(panel("ReactionPicker")).toBeNull();
  });

  it("tells the user when a write fails", async () => {
    toggleReactionFn.mockRejectedValueOnce(new Error("offline"));
    vi.spyOn(console, "error").mockImplementation(() => {});
    render(post(), true);
    await act(async () => trigger()!.click());
    const quick =
      panel("ReactionPicker")!.querySelector<HTMLButtonElement>(".ReactionQuick__emoji")!;
    await act(async () => quick.click());
    expect(showToast).toHaveBeenCalled();
  });
});
