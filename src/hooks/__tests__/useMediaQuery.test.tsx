import { describe, it, expect, afterEach, vi } from "vite-plus/test";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { useMediaQuery } from "@/hooks/useMediaQuery";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const Probe = ({ query }: { query: string }) => <span>{String(useMediaQuery(query))}</span>;

const render = () => {
  const container = document.createElement("div");
  const root = createRoot(container);
  act(() => root.render(<Probe query="(min-width: 768px)" />));
  return { container, unmount: () => act(() => root.unmount()) };
};

describe("useMediaQuery", () => {
  const original = window.matchMedia;
  afterEach(() => {
    window.matchMedia = original;
  });

  it("is false where matchMedia doesn't exist", () => {
    // @ts-expect-error simulating jsdom without matchMedia
    window.matchMedia = undefined;
    const { container, unmount } = render();
    expect(container.textContent).toBe("false");
    unmount();
  });

  it("follows the query as it starts and stops matching", () => {
    let matches = true;
    const listeners = new Set<() => void>();
    window.matchMedia = vi.fn(
      () =>
        ({
          get matches() {
            return matches;
          },
          addEventListener: (_: string, fn: () => void) => listeners.add(fn),
          removeEventListener: (_: string, fn: () => void) => listeners.delete(fn),
        }) as unknown as MediaQueryList,
    );
    const { container, unmount } = render();
    expect(container.textContent).toBe("true");

    matches = false;
    act(() => listeners.forEach((fn) => fn()));
    expect(container.textContent).toBe("false");

    unmount();
    expect(listeners.size).toBe(0);
  });
});
