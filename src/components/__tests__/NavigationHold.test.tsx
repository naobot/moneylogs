import { describe, it, expect, beforeEach, afterEach } from "vite-plus/test";
import { act } from "react";
import { createRoot, Root } from "react-dom/client";

import { NavigationHold } from "../NavigationHold";
import { holdNavigation } from "@/utils/navigationHold";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe("NavigationHold", () => {
  let container: HTMLDivElement;
  let root: Root;
  let link: HTMLAnchorElement;

  const clickLink = () => {
    const event = new MouseEvent("click", { bubbles: true, cancelable: true });
    link.dispatchEvent(event);
    return event.defaultPrevented;
  };

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    link = document.createElement("a");
    link.href = "/l/other";
    document.body.appendChild(link);
    root = createRoot(container);
    act(() => root.render(<NavigationHold />));
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    link.remove();
  });

  it("covers the app and stops links only while a call holds", () => {
    expect(container.querySelector(".NavigationHold")).toBeNull();
    link.addEventListener("click", (e) => e.preventDefault(), { once: true });
    expect(clickLink()).toBe(true); // our own preventDefault: the link is free to act

    let release!: () => void;
    act(() => {
      release = holdNavigation();
    });
    expect(container.querySelector(".NavigationHold")).not.toBeNull();
    let reached = false;
    link.addEventListener("click", () => (reached = true), { once: true });
    expect(clickLink()).toBe(true);
    expect(reached).toBe(false);

    act(() => release());
    expect(container.querySelector(".NavigationHold")).toBeNull();
    expect(clickLink()).toBe(false);
  });
});
