import { describe, it, expect, beforeEach, afterEach, vi } from "vite-plus/test";
import { act } from "react";
import { createRoot, Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";

const state = vi.hoisted(() => ({
  removeFriend: vi.fn((..._args: unknown[]) => Promise.resolve()),
}));
vi.mock("@/hooks/useFriendships", () => ({
  useFriendships: () => ({ stateWith: () => "friends", isLoading: false }),
  removeFriend: (...args: unknown[]) => state.removeFriend(...args),
  requestFriend: vi.fn(),
  respondFriend: vi.fn(),
}));
vi.mock("@/hooks/useToastContext", () => ({ useToastContext: () => ({ showToast: vi.fn() }) }));

import { FriendControls } from "../FriendControls";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe("FriendControls (friends)", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    state.removeFriend.mockClear();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    act(() =>
      root.render(
        <MemoryRouter>
          <FriendControls userDocId="mina" name="Mina" />
        </MemoryRouter>,
      ),
    );
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    document.getElementById("modal-root")?.replaceChildren();
  });

  const buttons = (label: string) =>
    [...document.querySelectorAll("button")].filter((b) => b.textContent?.trim() === label);
  const click = (el: Element) =>
    act(() => {
      (el as HTMLElement).click();
    });

  it("keeps unfriend out of sight and links the gift button to the gift picker", () => {
    expect(buttons("unfriend")).toHaveLength(0);
    const gift = container.querySelector("a.Button");
    expect(gift?.getAttribute("href")).toBe("/?giftTo=mina#knickknacks");
    expect(gift?.querySelector(".Icon")).not.toBeNull();
  });

  it("unfriends only after the menu and the confirm modal", async () => {
    const trigger = container.querySelector(".FriendControls__friends")!;
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
    click(trigger);
    expect(trigger.getAttribute("aria-expanded")).toBe("true");

    click(buttons("unfriend")[0]);
    expect(buttons("unfriend")).toHaveLength(0); // menu closed
    expect(state.removeFriend).not.toHaveBeenCalled();

    const confirm = document.querySelector("#modal-root button.Button--primary")!;
    await act(async () => {
      (confirm as HTMLElement).click();
    });
    expect(state.removeFriend).toHaveBeenCalledWith("mina");
  });
});
