import { describe, it, expect, beforeEach, afterEach } from "vite-plus/test";
import { act } from "react";
import { createRoot, Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { DisplaySection } from "@/features/account/DisplaySection";
import { getTheme, initTheme } from "@/utils/theme";
import { getDisplayPrefs, initDisplayPrefs } from "@/utils/displayPrefs";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe("DisplaySection", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    window.localStorage.clear();
    delete document.documentElement.dataset.theme;
    delete document.documentElement.dataset.entrySize;
    delete document.documentElement.dataset.entryAlign;
    initTheme();
    initDisplayPrefs();
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
  const group = (label: string) =>
    Array.from(container.querySelectorAll<HTMLButtonElement>(`[aria-label="${label}"] button`));
  const selected = (label: string) =>
    group(label).find((b) => b.classList.contains("Button--active"))?.textContent;

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

  it("labels clock and date options with live examples and switches them", () => {
    expect(group("Clock").map((b) => b.textContent)).toEqual(["14:05", "2:05pm"]);
    expect(group("Dates").map((b) => b.textContent)).toEqual(["24 Nov", "Nov 24", "11-24"]);
    expect(selected("Clock")).toBe("14:05");

    act(() => group("Clock")[1].click());
    act(() => group("Dates")[2].click());
    expect(getDisplayPrefs()).toMatchObject({ clock: "12h", dateOrder: "iso" });
    expect(selected("Clock")).toBe("2:05pm");
    expect(selected("Dates")).toBe("11-24");
  });

  it("sets entry size and alignment on the document", () => {
    act(() => group("Entry size")[3].click());
    act(() => group("Entry align")[2].click());
    expect(document.documentElement.dataset.entrySize).toBe("xl");
    expect(document.documentElement.dataset.entryAlign).toBe("justify");
    expect(selected("Entry size")).toBe("XL");
    expect(selected("Entry align")).toBe("Justify");
  });

  it("shows a sample entry", () => {
    expect(container.querySelector(".DisplaySample .wmde-markdown")).not.toBeNull();
  });
});
