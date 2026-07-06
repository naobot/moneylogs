import { describe, it, expect, beforeEach, afterEach } from "vite-plus/test";
import { act } from "react";
import { createRoot, Root } from "react-dom/client";
import useDragReorderEnabled from "@/hooks/useDragReorderEnabled";

const HORIZONTAL_NAV_QUERY = "(max-width: 768px)";
const COARSE_POINTER_QUERY = "(any-pointer: coarse)";
const FINE_POINTER_QUERY = "(any-pointer: fine)";

type FakeMediaQueryList = {
  media: string;
  matches: boolean;
  listeners: Set<() => void>;
  addEventListener: (type: string, cb: () => void) => void;
  removeEventListener: (type: string, cb: () => void) => void;
};

// Minimal matchMedia stand-in: caches one MediaQueryList per query so the hook's
// effect and its evaluate() calls share the same `matches`, and lets a test flip a
// query and fire its change listeners.
const installMatchMedia = (initial: Record<string, boolean>) => {
  const store = new Map<string, FakeMediaQueryList>();
  const get = (query: string) => {
    let mql = store.get(query);
    if (!mql) {
      const created: FakeMediaQueryList = {
        media: query,
        matches: initial[query] ?? false,
        listeners: new Set(),
        addEventListener: (_type, cb) => created.listeners.add(cb),
        removeEventListener: (_type, cb) => created.listeners.delete(cb),
      };
      mql = created;
      store.set(query, created);
    }
    return mql;
  };
  window.matchMedia = ((query: string) => get(query)) as unknown as typeof window.matchMedia;
  return {
    set(query: string, value: boolean) {
      const mql = get(query);
      mql.matches = value;
      act(() => mql.listeners.forEach((cb) => cb()));
    },
  };
};

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let latest: boolean | undefined;
const Probe = () => {
  latest = useDragReorderEnabled();
  return null;
};

describe("useDragReorderEnabled", () => {
  let container: HTMLDivElement;
  let root: Root;
  const originalMatchMedia = window.matchMedia;

  beforeEach(() => {
    latest = undefined;
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    window.matchMedia = originalMatchMedia;
  });

  const render = () => act(() => root.render(<Probe />));

  it("enables drag on a wide desktop with a fine pointer", () => {
    installMatchMedia({
      [HORIZONTAL_NAV_QUERY]: false,
      [COARSE_POINTER_QUERY]: false,
      [FINE_POINTER_QUERY]: true,
    });
    render();
    expect(latest).toBe(true);
  });

  it("disables drag when the nav is horizontal (small screen)", () => {
    installMatchMedia({
      [HORIZONTAL_NAV_QUERY]: true,
      [COARSE_POINTER_QUERY]: false,
      [FINE_POINTER_QUERY]: true,
    });
    render();
    expect(latest).toBe(false);
  });

  it("disables drag on a touch-only device even when wide", () => {
    installMatchMedia({
      [HORIZONTAL_NAV_QUERY]: false,
      [COARSE_POINTER_QUERY]: true,
      [FINE_POINTER_QUERY]: false,
    });
    render();
    expect(latest).toBe(false);
  });

  it("keeps drag on a hybrid laptop (touchscreen plus trackpad)", () => {
    installMatchMedia({
      [HORIZONTAL_NAV_QUERY]: false,
      [COARSE_POINTER_QUERY]: true,
      [FINE_POINTER_QUERY]: true,
    });
    render();
    expect(latest).toBe(true);
  });

  it("reacts when the viewport shrinks to the horizontal-nav breakpoint", () => {
    const mm = installMatchMedia({
      [HORIZONTAL_NAV_QUERY]: false,
      [COARSE_POINTER_QUERY]: false,
      [FINE_POINTER_QUERY]: true,
    });
    render();
    expect(latest).toBe(true);

    mm.set(HORIZONTAL_NAV_QUERY, true);
    expect(latest).toBe(false);
  });

  it("reacts when a mouse is unplugged from a touchscreen, leaving it touch-only", () => {
    const mm = installMatchMedia({
      [HORIZONTAL_NAV_QUERY]: false,
      [COARSE_POINTER_QUERY]: true,
      [FINE_POINTER_QUERY]: true,
    });
    render();
    expect(latest).toBe(true);

    mm.set(FINE_POINTER_QUERY, false);
    expect(latest).toBe(false);
  });
});
