import { describe, it, expect, beforeEach, afterEach, vi } from "vite-plus/test";
import { act } from "react";
import { createRoot, Root } from "react-dom/client";
import { HelpTip } from "../HelpTip";
import { HOVER_OPEN_DELAY } from "@/hooks/useHoverIntent";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe("HelpTip", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    vi.useFakeTimers();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    act(() => root.render(<HelpTip label="What is this?">it explains things</HelpTip>));
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.useRealTimers();
  });

  const button = () => container.querySelector<HTMLButtonElement>(".HelpTip")!;
  const tip = () => document.querySelector('[role="tooltip"]');

  it("labels the button and starts closed", () => {
    expect(button().getAttribute("aria-label")).toBe("What is this?");
    expect(tip()).toBeNull();
  });

  it("opens on focus and describes the button, closes on Escape", () => {
    act(() => button().focus());
    expect(tip()!.textContent).toBe("it explains things");
    expect(button().getAttribute("aria-describedby")).toBe(tip()!.querySelector("p")!.id);
    act(() => {
      button().dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    });
    expect(tip()).toBeNull();
  });

  it("opens after a beat of mouse hover and closes on leave", () => {
    act(() => {
      button().dispatchEvent(
        new PointerEvent("pointerover", { bubbles: true, pointerType: "mouse" }),
      );
    });
    expect(tip()).toBeNull();
    act(() => {
      vi.advanceTimersByTime(HOVER_OPEN_DELAY);
    });
    expect(tip()).not.toBeNull();
    act(() => {
      button().dispatchEvent(
        new PointerEvent("pointerout", { bubbles: true, pointerType: "mouse" }),
      );
    });
    expect(tip()).toBeNull();
  });

  it("stays open on a tap, and closes when tapping away", () => {
    act(() => {
      button().focus();
      button().click();
    });
    expect(tip()).not.toBeNull();
    act(() => button().blur());
    expect(tip()).toBeNull();
  });
});
