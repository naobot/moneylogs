import { describe, it, expect, beforeEach, afterEach, vi } from "vite-plus/test";
import { act } from "react";
import { createRoot, Root } from "react-dom/client";
import { useNow, DEFAULT_TICK_MS } from "@/hooks/useNow";

const START = new Date("2024-02-16T09:00:00.000Z");

let container: HTMLDivElement;
let root: Root;
let observed: string[] = [];

// Renders the hook and records the ISO string it returns on every render.
const Probe = ({ intervalMs }: { intervalMs?: number }) => {
  const now = useNow(intervalMs);
  observed.push(now.toISOString());
  return null;
};

const mount = (intervalMs?: number) => {
  act(() => {
    root.render(<Probe intervalMs={intervalMs} />);
  });
};

const setVisibility = (state: DocumentVisibilityState) => {
  Object.defineProperty(document, "visibilityState", {
    configurable: true,
    get: () => state,
  });
};

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(START);
  observed = [];
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  setVisibility("visible");
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.useRealTimers();
});

describe("useNow", () => {
  it("returns the current time on first render", () => {
    mount();
    expect(observed).toEqual([START.toISOString()]);
  });

  it("re-renders with an updated time once the interval elapses", () => {
    mount();
    act(() => {
      vi.advanceTimersByTime(DEFAULT_TICK_MS);
    });
    expect(observed).toHaveLength(2);
    expect(observed[1]).toBe("2024-02-16T09:01:00.000Z");
  });

  it("does not re-render before the interval elapses", () => {
    mount();
    act(() => {
      vi.advanceTimersByTime(DEFAULT_TICK_MS - 1);
    });
    expect(observed).toHaveLength(1);
  });

  it("honours a custom interval", () => {
    mount(5_000);
    act(() => {
      vi.advanceTimersByTime(5_000);
    });
    expect(observed[1]).toBe("2024-02-16T09:00:05.000Z");
  });

  it("ticks immediately when the tab becomes visible again", () => {
    mount();
    // Simulate a backgrounded tab whose interval was throttled: time moves on,
    // but no timer fires until the tab is focused again.
    setVisibility("hidden");
    vi.setSystemTime(new Date("2024-02-16T15:00:00.000Z"));
    expect(observed).toHaveLength(1);

    setVisibility("visible");
    act(() => {
      document.dispatchEvent(new Event("visibilitychange"));
    });
    expect(observed[observed.length - 1]).toBe("2024-02-16T15:00:00.000Z");
  });

  it("ignores visibilitychange while the tab is still hidden", () => {
    mount();
    setVisibility("hidden");
    act(() => {
      document.dispatchEvent(new Event("visibilitychange"));
    });
    expect(observed).toHaveLength(1);
  });

  it("stops ticking after unmount", () => {
    mount();
    act(() => root.unmount());
    const countAtUnmount = observed.length;
    act(() => {
      vi.advanceTimersByTime(DEFAULT_TICK_MS * 3);
    });
    expect(observed).toHaveLength(countAtUnmount);

    // Re-create a root so the shared afterEach unmount stays valid
    root = createRoot(container);
  });
});
