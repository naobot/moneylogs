import { afterEach, beforeEach } from "vite-plus/test";
import { act, ReactNode } from "react";
import { createRoot, Root } from "react-dom/client";
import { takeSnapshot } from "@chromatic-com/vitest";
import "@/index.css";
import "@/App.scss";
import hackRegular from "@/assets/fonts/Hack-regular.woff2?url";
import hackBold from "@/assets/fonts/Hack-bold.woff2?url";
import hackItalic from "@/assets/fonts/Hack-italic.woff2?url";
import hackBoldItalic from "@/assets/fonts/Hack-bolditalic.woff2?url";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const FONT_URLS = [hackRegular, hackBold, hackItalic, hackBoldItalic];

/**
 * Chromatic only archives what a test downloads while it runs, and points anything else
 * at the CI dev server (unreachable when Chromatic renders the snapshot). A face the
 * browser already had from an earlier test was left like that, so its text fell back to
 * the system monospace in some snapshots. Download every face again in each test.
 */
const archiveFonts = () =>
  Promise.all(FONT_URLS.map((url) => fetch(url, { cache: "no-store" }).then((r) => r.blob())));

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

  beforeEach(async () => {
    await archiveFonts();
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
