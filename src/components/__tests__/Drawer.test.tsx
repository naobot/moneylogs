import { describe, it, expect, beforeEach, afterEach } from "vite-plus/test";
import { act } from "react";
import { createRoot, Root } from "react-dom/client";
import Drawer from "@/components/Drawer";
import { readDrawerOpen } from "@/utils/drawerState";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe("Drawer", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    window.localStorage.clear();
    window.history.replaceState(null, "", "/me");
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  const details = () => container.querySelector<HTMLDetailsElement>("details")!;

  // jsdom doesn't toggle <details> on summary click, so simulate what the browser does.
  const toggle = () =>
    act(() => {
      details().open = !details().open;
      details().dispatchEvent(new Event("toggle"));
    });

  it("renders the title, hint and body, closed by default", () => {
    act(() =>
      root.render(
        <Drawer id="profile" title="Profile" summary="3 unlocked">
          <p>body</p>
        </Drawer>,
      ),
    );

    expect(details().id).toBe("profile");
    expect(details().open).toBe(false);
    expect(container.querySelector(".Drawer__title")?.textContent).toBe("Profile");
    expect(container.querySelector(".Drawer__hint")?.textContent).toBe("3 unlocked");
    expect(container.querySelector(".Drawer__body")?.textContent).toBe("body");
  });

  it("respects defaultOpen", () => {
    act(() =>
      root.render(
        <Drawer id="profile" title="Profile" defaultOpen>
          body
        </Drawer>,
      ),
    );
    expect(details().open).toBe(true);
    expect(details().className).toContain("Drawer--open");
  });

  it("remembers the open state across mounts", () => {
    act(() => root.render(<Drawer id="logs" title="Logs" children="body" />));
    toggle();
    expect(details().open).toBe(true);
    expect(readDrawerOpen("logs")).toBe(true);

    act(() => root.unmount());
    root = createRoot(container);
    act(() => root.render(<Drawer id="logs" title="Logs" children="body" />));
    expect(details().open).toBe(true);
  });

  it("a remembered closed state overrides defaultOpen", () => {
    act(() => root.render(<Drawer id="profile" title="Profile" defaultOpen children="body" />));
    toggle();
    expect(readDrawerOpen("profile")).toBe(false);

    act(() => root.unmount());
    root = createRoot(container);
    act(() => root.render(<Drawer id="profile" title="Profile" defaultOpen children="body" />));
    expect(details().open).toBe(false);
  });

  it("opens when the URL hash names it", () => {
    window.history.replaceState(null, "", "/me#logs");
    act(() =>
      root.render(
        <>
          <Drawer id="profile" title="Profile" children="a" />
          <Drawer id="logs" title="Logs" children="b" />
        </>,
      ),
    );
    const [profile, logs] = Array.from(container.querySelectorAll("details"));
    expect(profile.open).toBe(false);
    expect(logs.open).toBe(true);
  });
});
