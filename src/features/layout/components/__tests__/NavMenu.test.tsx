import { describe, it, expect, beforeEach, afterEach, vi } from "vite-plus/test";
import { act } from "react";
import { createRoot, Root } from "react-dom/client";
import { MemoryRouter, NavigateFunction, useNavigate } from "react-router-dom";
import { getDisplayPrefs, initDisplayPrefs } from "@/utils/displayPrefs";
import { getTheme, initTheme } from "@/utils/theme";

const mocks = vi.hoisted(() => ({ signOut: vi.fn(), track: vi.fn() }));
vi.mock("@/features/auth/hooks/useSignOut", () => ({
  useSignOut: () => ({ signOut: mocks.signOut, isPending: false }),
}));
vi.mock("@/utils/analytics", () => ({ track: mocks.track }));

import { NavMenu } from "@/features/layout/components/NavMenu";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe("NavMenu", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    window.localStorage.clear();
    delete document.documentElement.dataset.textSize;
    delete document.documentElement.dataset.uiSize;
    delete document.documentElement.dataset.theme;
    initTheme();
    initDisplayPrefs();
    mocks.signOut.mockReset();
    mocks.track.mockReset();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    document.getElementById("modal-root")?.remove();
  });

  const render = (isLoggedIn: boolean) =>
    act(() =>
      root.render(
        <MemoryRouter>
          <NavMenu isLoggedIn={isLoggedIn} />
        </MemoryRouter>,
      ),
    );
  const trigger = () => container.querySelector<HTMLButtonElement>(".NavMenu__trigger")!;
  const items = () => Array.from(document.querySelectorAll<HTMLButtonElement>("[role=menuitem]"));
  const item = (name: string) => items().find((b) => b.textContent?.includes(name));
  const toggle = () => act(() => trigger().click());

  it("opens a menu with display and sign out, focusing the first item", () => {
    render(true);
    expect(trigger().getAttribute("aria-expanded")).toBe("false");
    expect(items()).toHaveLength(0);

    toggle();
    expect(trigger().getAttribute("aria-expanded")).toBe("true");
    expect(items().map((b) => b.textContent)).toEqual(["display", "theme · paper", "sign out"]);
    expect(document.activeElement).toBe(item("display"));

    toggle();
    expect(items()).toHaveLength(0);
  });

  it("closes on navigation and stays closed on returning to the page", () => {
    let navigate: NavigateFunction = () => {};
    const Nav = () => {
      navigate = useNavigate();
      return null;
    };
    act(() =>
      root.render(
        <MemoryRouter initialEntries={["/a"]}>
          <Nav />
          <NavMenu isLoggedIn />
        </MemoryRouter>,
      ),
    );
    toggle();
    expect(items().length).toBeGreaterThan(0);

    // Away without a tap outside (e.g. Android's back button), then back again.
    act(() => void navigate("/b"));
    expect(items()).toHaveLength(0);
    act(() => void navigate(-1));
    expect(items()).toHaveLength(0);
    expect(trigger().getAttribute("aria-expanded")).toBe("false");
  });

  it("closes on Escape", () => {
    render(true);
    toggle();
    act(() => {
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    });
    expect(items()).toHaveLength(0);
  });

  it("cycles the theme from the menu and stays open", () => {
    render(true);
    toggle();
    act(() => item("theme")!.click());
    expect(getTheme()).toBe("night");
    expect(item("theme")!.textContent).toBe("theme · night shift");
    expect(item("theme")!.getAttribute("aria-label")).toBe("Theme: Night shift. Switch to Paper");
  });

  it("signs out from the menu", () => {
    render(true);
    toggle();
    act(() => item("sign out")!.click());
    expect(mocks.signOut).toHaveBeenCalledOnce();
  });

  it("offers only display when signed out", () => {
    render(false);
    toggle();
    expect(items().map((b) => b.textContent)).toEqual(["display", "theme · paper"]);
    expect(trigger().getAttribute("aria-label")).toBe("Menu: display and theme");
  });

  it("opens quick display settings that change text and UI size", () => {
    render(true);
    toggle();
    act(() => item("display")!.click());

    expect(items()).toHaveLength(0);
    expect(mocks.track).toHaveBeenCalledWith("quick_display", { signed_in: true });
    const modal = document.getElementById("modal-root")!;
    expect(modal.querySelector(".Modal__title")?.textContent).toBe("display");

    const group = (label: string) =>
      Array.from(modal.querySelectorAll<HTMLButtonElement>(`[aria-label="${label}"] button`));
    act(() => group("Text size")[2].click());
    expect(getDisplayPrefs().textSize).toBe("l");
    expect(document.documentElement.dataset.textSize).toBe("l");
    expect(mocks.track).toHaveBeenCalledWith("text_size", { size: "l", from: "nav" });

    act(() => group("UI size")[0].click());
    expect(getDisplayPrefs().uiSize).toBe("s");
    expect(mocks.track).toHaveBeenCalledWith("ui_size", { size: "s", from: "nav" });

    expect(modal.querySelector('a[href="/me#display"]')?.textContent).toBe("all display settings");
  });

  it("leaves out the /me link when signed out", () => {
    render(false);
    toggle();
    act(() => item("display")!.click());
    const modal = document.getElementById("modal-root")!;
    expect(modal.querySelector('[aria-label="Text size"]')).not.toBeNull();
    expect(modal.querySelector('a[href="/me#display"]')).toBeNull();
  });
});
