import { describe, it, expect, beforeEach, afterEach } from "vite-plus/test";
import { act } from "react";
import { ReactNode } from "react";
import { createRoot, Root } from "react-dom/client";
import { MemoryRouter, NavigateFunction, useNavigate } from "react-router-dom";
import Drawer from "@/components/Drawer";
import { readDrawerOpen } from "@/utils/drawerState";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe("Drawer", () => {
  let container: HTMLDivElement;
  let root: Root;
  let navigate: NavigateFunction;

  const CaptureNavigate = () => {
    navigate = useNavigate();
    return null;
  };

  // Drawers follow the router location, so render them inside one.
  const inRouter = (ui: ReactNode, at = "/me") => (
    <MemoryRouter initialEntries={[at]}>
      <CaptureNavigate />
      {ui}
    </MemoryRouter>
  );

  beforeEach(() => {
    window.localStorage.clear();
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
        inRouter(
          <Drawer id="profile" title="Profile" summary="3 unlocked">
            <p>body</p>
          </Drawer>,
        ),
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
        inRouter(
          <Drawer id="profile" title="Profile" defaultOpen>
            body
          </Drawer>,
        ),
      ),
    );
    expect(details().open).toBe(true);
    expect(details().className).toContain("Drawer--open");
  });

  it("remembers the open state across mounts", () => {
    act(() => root.render(inRouter(<Drawer id="logs" title="Logs" children="body" />)));
    toggle();
    expect(details().open).toBe(true);
    expect(readDrawerOpen("logs")).toBe(true);

    act(() => root.unmount());
    root = createRoot(container);
    act(() => root.render(inRouter(<Drawer id="logs" title="Logs" children="body" />)));
    expect(details().open).toBe(true);
  });

  it("a remembered closed state overrides defaultOpen", () => {
    act(() =>
      root.render(inRouter(<Drawer id="profile" title="Profile" defaultOpen children="body" />)),
    );
    toggle();
    expect(readDrawerOpen("profile")).toBe(false);

    act(() => root.unmount());
    root = createRoot(container);
    act(() =>
      root.render(inRouter(<Drawer id="profile" title="Profile" defaultOpen children="body" />)),
    );
    expect(details().open).toBe(false);
  });

  it("opens when the URL hash names it", () => {
    act(() =>
      root.render(
        inRouter(
          <>
            <Drawer id="profile" title="Profile" children="a" />
            <Drawer id="logs" title="Logs" children="b" />
          </>,
          "/me#logs",
        ),
      ),
    );
    const [profile, logs] = Array.from(container.querySelectorAll("details"));
    expect(profile.open).toBe(false);
    expect(logs.open).toBe(true);
  });

  it("opens when navigated to its hash while already on the page", () => {
    act(() =>
      root.render(
        inRouter(
          <>
            <Drawer id="profile" title="Profile" defaultOpen children="a" />
            <Drawer id="logs" title="Logs" children="b" />
          </>,
        ),
      ),
    );
    const logs = () => container.querySelectorAll("details")[1];
    expect(logs().open).toBe(false);

    act(() => void navigate("/me#logs"));
    expect(logs().open).toBe(true);
    expect(readDrawerOpen("logs")).toBe(true);
  });

  it("reopens when the same hash link is followed again after closing it", () => {
    act(() => root.render(inRouter(<Drawer id="logs" title="Logs" children="b" />, "/me#logs")));
    expect(details().open).toBe(true);

    toggle();
    expect(details().open).toBe(false);

    act(() => void navigate("/me#logs"));
    expect(details().open).toBe(true);
  });

  it("overrides a remembered closed state when linked", () => {
    window.localStorage.setItem("ML__drawer_logs", "0");
    act(() => root.render(inRouter(<Drawer id="logs" title="Logs" children="b" />, "/me#logs")));
    expect(details().open).toBe(true);
  });
});
