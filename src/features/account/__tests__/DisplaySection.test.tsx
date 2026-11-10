import { describe, it, expect, beforeEach, afterEach } from "vite-plus/test";
import { act } from "react";
import { createRoot, Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { DisplaySection } from "@/features/account/DisplaySection";
import { getTheme, initTheme } from "@/utils/theme";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe("DisplaySection", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    window.localStorage.clear();
    delete document.documentElement.dataset.theme;
    initTheme();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    act(() =>
      root.render(
        <MemoryRouter>
          <DisplaySection />
        </MemoryRouter>,
      ),
    );
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  const buttons = () => Array.from(container.querySelectorAll<HTMLButtonElement>("button"));
  const active = () => buttons().find((b) => b.classList.contains("Button--active"))!;

  it("marks the current theme and switches to night shift", () => {
    expect(active().textContent).toBe("Paper");

    act(() => buttons()[1].click());
    expect(getTheme()).toBe("night");
    expect(document.documentElement.dataset.theme).toBe("night");
    expect(active().textContent).toBe("Night shift");

    act(() => buttons()[0].click());
    expect(getTheme()).toBe("paper");
    expect(active().textContent).toBe("Paper");
  });
});
