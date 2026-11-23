import { describe, it, expect, beforeEach, afterEach, vi } from "vite-plus/test";
import { act } from "react";
import { createRoot, Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";

const state = vi.hoisted(() => ({ user: null as { isAnonymous: boolean } | null }));
vi.mock("@/config/firebase-config", () => ({ auth: {}, db: {} }));
vi.mock("react-firebase-hooks/auth", () => ({ useAuthState: () => [state.user] }));

import { GuestBanner } from "../GuestBanner";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe("GuestBanner", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    root = createRoot(container);
  });
  afterEach(() => act(() => root.unmount()));

  const render = () =>
    act(() =>
      root.render(
        <MemoryRouter>
          <GuestBanner />
        </MemoryRouter>,
      ),
    );

  it("points a guest at saving their account", () => {
    state.user = { isAnonymous: true };
    render();
    expect(container.textContent).toContain("you're trying moneylogs as a guest.");
    expect(container.querySelector("a")!.getAttribute("href")).toBe("/me#account");
  });

  it("stays out of the way for everyone else", () => {
    state.user = { isAnonymous: false };
    render();
    expect(container.innerHTML).toBe("");
  });
});
