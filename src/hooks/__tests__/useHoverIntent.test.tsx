import { describe, it, expect, beforeEach, afterEach, vi } from "vite-plus/test";
import { act } from "react";
import { createRoot, Root } from "react-dom/client";
import { HOVER_CLOSE_DELAY, HOVER_OPEN_DELAY, useHoverIntent } from "@/hooks/useHoverIntent";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const probe: { intent?: ReturnType<typeof useHoverIntent> } = {};
const Probe = () => {
  probe.intent = useHoverIntent();
  return null;
};
const intent = () => probe.intent!;

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  vi.useFakeTimers();
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => root.render(<Probe />));
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.useRealTimers();
});

describe("useHoverIntent", () => {
  it("opens only after the delay", () => {
    const open = vi.fn();
    intent().openAfterDelay(open);
    vi.advanceTimersByTime(HOVER_OPEN_DELAY - 1);
    expect(open).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(open).toHaveBeenCalledOnce();
  });

  it("doesn't open if the pointer leaves first", () => {
    const open = vi.fn();
    intent().openAfterDelay(open);
    intent().cancelOpen();
    vi.advanceTimersByTime(HOVER_OPEN_DELAY);
    expect(open).not.toHaveBeenCalled();
  });

  it("restarts the open delay on a second hover", () => {
    const first = vi.fn();
    const second = vi.fn();
    intent().openAfterDelay(first);
    vi.advanceTimersByTime(HOVER_OPEN_DELAY - 50);
    intent().openAfterDelay(second);
    vi.advanceTimersByTime(HOVER_OPEN_DELAY - 1);
    expect(first).not.toHaveBeenCalled();
    expect(second).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(second).toHaveBeenCalledOnce();
  });

  it("holds a pending close when the pointer comes back", () => {
    const close = vi.fn();
    intent().closeAfterDelay(close);
    intent().cancelClose();
    vi.advanceTimersByTime(HOVER_CLOSE_DELAY);
    expect(close).not.toHaveBeenCalled();
    intent().closeAfterDelay(close);
    vi.advanceTimersByTime(HOVER_CLOSE_DELAY);
    expect(close).toHaveBeenCalledOnce();
  });

  it("clears pending timers on unmount", () => {
    const open = vi.fn();
    const close = vi.fn();
    intent().openAfterDelay(open);
    intent().closeAfterDelay(close);
    act(() => root.unmount());
    vi.advanceTimersByTime(HOVER_OPEN_DELAY);
    expect(open).not.toHaveBeenCalled();
    expect(close).not.toHaveBeenCalled();
    root = createRoot(container);
  });
});
