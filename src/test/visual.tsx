import { afterEach, beforeEach } from "vite-plus/test";
import { act, ReactNode } from "react";
import { createRoot, Root } from "react-dom/client";
import { takeSnapshot } from "@chromatic-com/vitest";
import { page, server } from "vite-plus/test/browser/context";
import { DEFAULT_DISPLAY_PREFS, setDisplayPrefs, TextSize, UiSize } from "@/utils/displayPrefs";
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

type Size = TextSize & UiSize;
const SIZES: readonly Size[] = ["s", "m", "l"];

/** A phone, where sizes get tight first. */
export const PHONE = { width: 390, height: 844 };
/** The browser's size in the visual project unless a test changes it. */
const DEFAULT_VIEWPORT = { width: 414, height: 896 };

/**
 * The text × UI size pairs that also go to Chromatic. Every pair goes to the local review
 * gallery, but each Chromatic snapshot counts against the plan, so it only gets the
 * default and the two extremes that break layouts first.
 */
const CHROMATIC_PAIRS: readonly [text: Size, ui: Size][] = [
  ["m", "m"],
  ["l", "l"], // biggest: text and room both up
  ["l", "s"], // most cramped: big text, tight room
];

/** Through the real prefs, so <html> gets the attribute and anything showing the
 *  current choice (the Display drawer) re-renders to match. */
const setSize = (key: "textSize" | "uiSize", size: Size) =>
  act(() => setDisplayPrefs({ [key]: size }));

/** Two frames: one for styles to apply, one for anything that measures layout. */
const settle = () =>
  new Promise<void>((resolve) =>
    requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
  );

const slug = (name: string) =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

/** Where the review gallery's screenshots go (gitignored); see scripts/visual-gallery.mjs. */
const galleryPath = (scene: string, text: Size, ui: Size) =>
  `${server.config.root}/.vitest/gallery/${slug(scene)}/text-${text}__ui-${ui}.png`;

/**
 * Shared harness for *.visual.test.tsx files: mounts into a fresh root per test and
 * cleans up after (including portals, the night theme, UI size and text size). Call inside a `describe`.
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
    // <body> is a flex row; without this the container grows to its content and runs
    // past a phone's width instead of wrapping like the app does.
    container.style.width = "100%";
    container.style.minWidth = "0";
    container.style.alignSelf = "flex-start";
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    act(() => root.unmount());
    setDisplayPrefs(DEFAULT_DISPLAY_PREFS);
    container.remove();
    document.getElementById("modal-root")?.remove();
    document.body.style.overflow = "";
    delete document.documentElement.dataset.theme;
    delete document.documentElement.dataset.uiSize;
    delete document.documentElement.dataset.textSize;
    await page.viewport(DEFAULT_VIEWPORT.width, DEFAULT_VIEWPORT.height);
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
    /** Switch the Display → UI size (reset after each test). M is the default. */
    uiSize: (size: Size) => setSize("uiSize", size),
    /** Switch the Display → Text size (reset after each test). M is the default. */
    textSize: (size: Size) => setSize("textSize", size),
    /** Set the browser's size (reset after each test). */
    viewport: (size: { width: number; height: number }) => page.viewport(size.width, size.height),
    /**
     * Walks the rendered UI through every Display → Text size × UI size pair at phone
     * width: each one is saved to the local review gallery (.vitest/gallery/<scene>/),
     * and the pairs in CHROMATIC_PAIRS are also snapshotted for Chromatic as
     * "<scene> · text X · ui Y". Render first; the sizes are CSS, so nothing re-renders.
     */
    sizes: async (scene: string) => {
      await page.viewport(PHONE.width, PHONE.height);
      for (const text of SIZES) {
        for (const ui of SIZES) {
          setSize("textSize", text);
          setSize("uiSize", ui);
          await settle();
          // An open modal is portalled outside the container and fixed to the viewport,
          // so it's shot at a phone's height. Anything else grows the viewport to fit:
          // tests run in an iframe that only paints what's inside it.
          const modalOpen = !!document.getElementById("modal-root")?.childElementCount;
          await page.viewport(
            PHONE.width,
            modalOpen ? PHONE.height : Math.max(PHONE.height, Math.ceil(container.scrollHeight)),
          );
          await settle();
          await page.screenshot({
            element: modalOpen ? document.body : container,
            path: galleryPath(scene, text, ui),
          });
          if (CHROMATIC_PAIRS.some(([t, u]) => t === text && u === ui)) {
            await takeSnapshot(`${scene} · text ${text} · ui ${ui}`);
          }
        }
      }
    },
  };
};
