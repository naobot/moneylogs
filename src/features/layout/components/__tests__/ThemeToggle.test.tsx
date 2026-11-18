import { describe, it, expect, beforeEach, afterEach } from "vite-plus/test";
import { act } from "react";
import { createRoot, Root } from "react-dom/client";
import { ThemeToggle } from "@/features/layout/components/ThemeToggle";
import { getTheme, initTheme, setTheme } from "@/utils/theme";

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
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  const render = (isLoggedIn: boolean) =>
    act(() => root.render(<ThemeToggle isLoggedIn={isLoggedIn} />));
  const button = () => container.querySelector("button")!;
  const icon = () => container.querySelector("img")!.getAttribute("src");
  const click = () => act(() => button().click());

  it("is icon-only and shows the current theme's icon", () => {
    render(true);
    expect(button().textContent).toBe("");
    expect(icon()).toBe("/icons/nakals-sun.svg");
    expect(button().title).toBe("Switch to Night shift");
    expect(button().getAttribute("aria-label")).toBe("Theme: Paper. Switch to Night shift");
  });

  it("toggles Paper and Night shift before any colour theme is picked", () => {
    render(true);
    click();
    expect(getTheme()).toBe("night");
    expect(document.documentElement.dataset.theme).toBe("night");
    expect(icon()).toBe("/icons/nakals-moon.svg");
    expect(button().title).toBe("Switch to Paper");

    click();
    expect(getTheme()).toBe("paper");
    expect(document.documentElement.dataset.theme).toBeUndefined();
  });

  it("cycles through the last colour theme as the star when signed in", () => {
    act(() => {
      setTheme("blueprint");
      setTheme("paper");
    });
    render(true);
    expect(button().title).toBe("Switch to Blueprint");

    click();
    expect(getTheme()).toBe("blueprint");
    expect(icon()).toBe("/icons/moneylogs-star.svg");

    click();
    expect(getTheme()).toBe("night");
    expect(icon()).toBe("/icons/nakals-moon.svg");

    click();
    expect(getTheme()).toBe("paper");
    expect(icon()).toBe("/icons/nakals-sun.svg");
  });

  it("leaves the star out when signed out, but still shows it for a colour theme", () => {
    act(() => setTheme("paper"));
    act(() => setTheme("riso"));
    render(false);
    expect(icon()).toBe("/icons/moneylogs-star.svg");

    click();
    expect(getTheme()).toBe("night");
    click();
    expect(getTheme()).toBe("paper");
    click();
    expect(getTheme()).toBe("night");
  });
});
