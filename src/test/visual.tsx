import { afterEach, beforeEach } from "vite-plus/test";
import { act, ReactNode } from "react";
import { createRoot, Root } from "react-dom/client";
import { takeSnapshot } from "@chromatic-com/vitest";
import "@/index.css";
import "@/App.scss";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

/**
 * Shared harness for *.visual.test.tsx files: mounts into a fresh root per test and
 * cleans up after (including portals and the night theme). Call inside a `describe`.
 *
 * Auto-snapshots are off (vitest.config.ts) because they fire after unmount, so each
 * test calls `snapshot(name)` itself once the UI is in the state worth capturing.
 */
export const useVisualHarness = () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    window.localStorage.clear();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    document.getElementById("modal-root")?.remove();
    document.body.style.overflow = "";
    delete document.documentElement.dataset.theme;
  });

  return {
    get container() {
      return container;
    },
    render: (ui: ReactNode) =>
      act(() =>
        root.render(
          // Stacks variants with breathing room, so each one reads clearly in the snapshot.
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem", padding: "1rem" }}>
            {ui}
          </div>,
        ),
      ),
    snapshot: (name: string) => takeSnapshot(name),
    /** Switch to night shift (reset after each test). */
    night: () => {
      document.documentElement.dataset.theme = "night";
    },
  };
};
