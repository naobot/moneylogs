import { describe, it, expect, beforeEach, afterEach } from "vite-plus/test";
import { act } from "react";
import { createRoot, Root } from "react-dom/client";
import { ThemeToggle } from "@/features/layout/components/ThemeToggle";
import { getTheme, initTheme } from "@/utils/theme";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe("ThemeToggle", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    window.localStorage.clear();
    delete document.documentElement.dataset.theme;
    initTheme();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    act(() => root.render(<ThemeToggle />));
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  const button = () => container.querySelector("button")!;
  const iconSrc = () => container.querySelector("img")!.getAttribute("src");

  it("is icon-only, offering the moon in Paper", () => {
    expect(button().textContent).toBe("");
    expect(button().title).toBe("Switch to Night shift");
    expect(iconSrc()).toBe("/icons/nakals-moon.svg");
  });

  it("toggles between Night shift and Paper", () => {
    act(() => button().click());
    expect(getTheme()).toBe("night");
    expect(document.documentElement.dataset.theme).toBe("night");
    expect(button().title).toBe("Switch to Paper");
    expect(iconSrc()).toBe("/icons/nakals-sun.svg");

    act(() => button().click());
    expect(getTheme()).toBe("paper");
    expect(document.documentElement.dataset.theme).toBeUndefined();
  });
});
