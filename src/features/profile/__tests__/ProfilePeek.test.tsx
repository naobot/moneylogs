import { describe, it, expect, beforeEach, afterEach, vi } from "vite-plus/test";
import { act } from "react";
import { createRoot, Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";

const state = vi.hoisted(() => ({
  me: "me" as string | null,
  friendState: "none" as string,
  requestFriend: vi.fn((..._args: unknown[]) => Promise.resolve("outgoing")),
  outerClick: vi.fn(),
}));
vi.mock("@/contexts", () => ({
  useCurrentUser: () => ({ user: state.me ? { id: state.me, userId: "uid-me" } : undefined }),
}));
vi.mock("@/hooks/useProfiles", () => ({
  useProfile: (id: string) => ({
    profile: {
      id,
      displayName: "Mina",
      displayLocation: "Kyoto",
      timezone: "Asia/Tokyo",
      avatar: null,
    },
    isLoading: false,
  }),
}));
vi.mock("@/hooks/useFriendships", () => ({
  useFriendships: () => ({
    stateWith: () => state.friendState,
    uidOf: () => null,
    isLoading: false,
  }),
  requestFriend: (...args: unknown[]) => state.requestFriend(...args),
  respondFriend: vi.fn(),
}));
vi.mock("@/hooks/useToastContext", () => ({ useToastContext: () => ({ showToast: vi.fn() }) }));

import { ProfilePeek, PROFILE_PEEK_DELAY } from "../ProfilePeek";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe("ProfilePeek", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    vi.useFakeTimers();
    state.me = "me";
    state.friendState = "none";
    state.requestFriend.mockClear();
    state.outerClick.mockClear();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    document.querySelectorAll(".ProfilePeek").forEach((el) => el.remove());
    vi.useRealTimers();
  });

  const render = (userDocId = "mina") =>
    act(() =>
      root.render(
        <MemoryRouter>
          {/* Stands in for the avatar's link / a clickable member row. */}
          <div onClick={state.outerClick}>
            <ProfilePeek userDocId={userDocId} name="Mina">
              <span className="avatar">m</span>
            </ProfilePeek>
          </div>
        </MemoryRouter>,
      ),
    );
  const anchor = () => container.querySelector(".ProfilePeek__anchor");
  const point = (type: "pointerover" | "pointerout", pointerType = "mouse") =>
    act(() => {
      anchor()!.dispatchEvent(new PointerEvent(type, { bubbles: true, pointerType }));
    });
  const card = () => document.querySelector(".ProfilePeek");

  it("opens only after the mouse rests on the avatar", () => {
    render();
    point("pointerover");
    act(() => vi.advanceTimersByTime(PROFILE_PEEK_DELAY - 50));
    expect(card()).toBeNull();
    act(() => vi.advanceTimersByTime(50));
    expect(card()!.textContent).toContain("Mina");
    expect(card()!.textContent).toContain("Kyoto");
  });

  it("doesn't open when the mouse just passes over", () => {
    render();
    point("pointerover");
    act(() => vi.advanceTimersByTime(PROFILE_PEEK_DELAY / 2));
    point("pointerout");
    act(() => vi.advanceTimersByTime(PROFILE_PEEK_DELAY * 2));
    expect(card()).toBeNull();
  });

  it("ignores touch", () => {
    render();
    point("pointerover", "touch");
    act(() => vi.advanceTimersByTime(PROFILE_PEEK_DELAY * 2));
    expect(card()).toBeNull();
  });

  it("isn't there for yourself or when signed out", () => {
    render("me");
    expect(anchor()).toBeNull();
    state.me = null;
    render("mina");
    expect(anchor()).toBeNull();
  });

  it("adds a friend from the card without clicking through", async () => {
    render();
    point("pointerover");
    act(() => vi.advanceTimersByTime(PROFILE_PEEK_DELAY));
    const add = Array.from(card()!.querySelectorAll("button")).find((b) =>
      /add friend/i.test(b.textContent ?? ""),
    )!;
    await act(async () => add.click());
    expect(state.requestFriend).toHaveBeenCalledWith("mina");
    expect(state.outerClick).not.toHaveBeenCalled();
  });

  it("shows where you stand instead of the button", () => {
    state.friendState = "friends";
    render();
    point("pointerover");
    act(() => vi.advanceTimersByTime(PROFILE_PEEK_DELAY));
    expect(card()!.textContent).toContain("friends");
    expect(card()!.textContent).not.toMatch(/add friend/i);
  });
});
