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
/** A narrow phone (many Androids, older iPhones at zoomed display): where text collides. */
export const NARROW_PHONE = { width: 360, height: 780 };
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

/** On a narrow phone, the pairs where things collide first; Chromatic gets the last. */
const NARROW_PAIRS: readonly [text: Size, ui: Size][] = [
  ["m", "m"],
  ["l", "m"],
  ["l", "l"],
];

/** Through the real prefs, so <html> gets the attribute and anything showing the
 *  current choice (the Display drawer) re-renders to match. */
const setSize = (key: "textSize" | "uiSize", size: Size) =>
  act(() => setDisplayPrefs({ [key]: size }));

/** Two frames: one for styles to apply, one for anything that measures layout. */
// Two frames for layout, after every image has loaded: an icon fetched for the first
// time otherwise shows as a broken image in the shot.
const settle = async () => {
  await Promise.all(Array.from(document.images).map((img) => img.decode().catch(() => undefined)));
  await new Promise<void>((resolve) =>
    requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
  );
};

/** The phone type ladder's floor (tokens.scss --phone-micro): nothing renders smaller. */
export const TYPE_FLOOR_PX = 11;

const describeOne = (el: Element) =>
  `${el.tagName.toLowerCase()}${Array.from(el.classList)
    .slice(0, 2)
    .map((c) => `.${c}`)
    .join("")}`;

/** The element, after its nearest ancestor with a class when it has none of its own. */
const describeElement = (el: Element) => {
  if (el.classList.length) return describeOne(el);
  const named = el.parentElement?.closest("[class]");
  return named ? `${describeOne(named)} ${describeOne(el)}` : describeOne(el);
};

/**
 * Every visible element that sets its own text (a non-blank direct text node) below
 * TYPE_FLOOR_PX, as "selector (10.5px): text". Screen-reader-only text (clipped to a
 * pixel) doesn't count.
 */
export const textBelowFloor = (root: Element): string[] => {
  const found = new Map<string, string>();
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const text = node.textContent?.trim();
    const el = node.parentElement;
    if (!text || !el) continue;
    const rect = el.getBoundingClientRect();
    if (rect.width <= 1 || rect.height <= 1) continue;
    const style = getComputedStyle(el);
    if (style.visibility === "hidden" || style.display === "none") continue;
    const size = parseFloat(style.fontSize);
    if (size >= TYPE_FLOOR_PX - 0.01) continue;
    const key = `${describeElement(el)} (${Math.round(size * 10) / 10}px)`;
    if (!found.has(key)) found.set(key, `${key}: ${text.slice(0, 30)}`);
  }
  return [...found.values()];
};

const INTERACTIVE =
  "button, a[href], input, select, textarea, label, [role=button], [role=tab], [tabindex]";

/**
 * Where a control's grown hit area lies over another control's own box and takes the tap
 * from it, as "taker → victim". Samples points in each overlap with elementFromPoint, so
 * it only sees what's inside the viewport.
 */
export const stolenTaps = (root: Element): string[] => {
  const found = new Set<string>();
  const others = Array.from(root.querySelectorAll(INTERACTIVE));
  for (const taker of others) {
    // A grown hit area is an absolutely placed ::after (App.scss), centred on the control.
    const after = getComputedStyle(taker, "::after");
    if (after.content === "none" || after.position !== "absolute") continue;
    const own = taker.getBoundingClientRect();
    if (own.width === 0 || own.height === 0) continue;
    const w = Math.max(own.width, parseFloat(after.width) || 0);
    const h = Math.max(own.height, parseFloat(after.height) || 0);
    const cx = own.left + own.width / 2;
    const cy = own.top + own.height / 2;
    const area = { left: cx - w / 2, right: cx + w / 2, top: cy - h / 2, bottom: cy + h / 2 };
    for (const victim of others) {
      if (victim === taker || victim.contains(taker) || taker.contains(victim)) continue;
      const box = victim.getBoundingClientRect();
      const left = Math.max(area.left, box.left);
      const right = Math.min(area.right, box.right);
      const top = Math.max(area.top, box.top);
      const bottom = Math.min(area.bottom, box.bottom);
      if (right - left < 1 || bottom - top < 1) continue;
      sample: for (let i = 1; i <= 4; i++) {
        for (let j = 1; j <= 4; j++) {
          const x = left + ((right - left) * i) / 5;
          const y = top + ((bottom - top) * j) / 5;
          const hit = document.elementFromPoint(x, y);
          if (hit && taker.contains(hit) && !victim.contains(hit)) {
            found.add(`${describeElement(taker)} → ${describeElement(victim)}`);
            break sample;
          }
        }
      }
    }
  }
  return [...found];
};

/** The scene the harness last mounted, for the phone rules. */
let currentContainer: HTMLDivElement | undefined;

/**
 * Controls whose grown hit area doesn't reach past their own box: something clips it
 * (an `overflow: hidden` on the control or a scrolling row around it). Samples just
 * outside each edge, inside the area it should cover; a tap there that lands on another
 * control is stolenTaps' business, not this.
 */
export const clippedTapAreas = (root: Element): string[] => {
  const found = new Set<string>();
  const controls = Array.from(root.querySelectorAll(INTERACTIVE));
  for (const control of controls) {
    const after = getComputedStyle(control, "::after");
    if (after.content === "none" || after.position !== "absolute") continue;
    const box = control.getBoundingClientRect();
    if (box.width === 0 || box.height === 0) continue;
    const w = parseFloat(after.width) || 0;
    const h = parseFloat(after.height) || 0;
    const cx = box.left + box.width / 2;
    const cy = box.top + box.height / 2;
    // Under an open modal or sheet: not reachable at all, so nothing to clip.
    const atCentre = document.elementFromPoint(cx, cy);
    if (atCentre && !control.contains(atCentre)) continue;
    // Sample halfway into the margin the area adds past each edge. A margin under a
    // pixel (a 43.4px button grown to 44) is rounding, and font metrics differ between
    // machines, so it isn't checked.
    const marginY = (h - box.height) / 2;
    const marginX = (w - box.width) / 2;
    const points: [number, number][] = [];
    if (marginY >= 1) points.push([cx, box.top - marginY / 2], [cx, box.bottom + marginY / 2]);
    if (marginX >= 1) points.push([box.left - marginX / 2, cy], [box.right + marginX / 2, cy]);
    for (const [x, y] of points) {
      if (x < 0 || y < 0 || x >= window.innerWidth || y >= window.innerHeight) continue;
      const hit = document.elementFromPoint(x, y);
      if (!hit || control.contains(hit)) continue;
      if (controls.some((other) => other !== control && other.contains(hit))) continue;
      // Known: a modal's content box scrolls (overflow-y: auto), so it clips the buttons
      // at its edges. The Modal rework (docs/design PLAN item 8: bottom sheet, pinned
      // footer) gives them room; until then this one clip isn't reported.
      const modal = control.closest(".Modal__content");
      if (modal && !modal.contains(hit)) continue;
      if (hit.closest(".Modal__footer, .Modal__header") && modal?.contains(hit)) continue;
      found.add(
        `${describeElement(control)} "${control.textContent?.trim().slice(0, 12)}" (${x < box.left ? "left" : x > box.right ? "right" : y < box.top ? "top" : "bottom"} edge lands on ${describeElement(hit)})`,
      );
      break;
    }
  }
  return [...found];
};

/**
 * The 2026-11 phone rules, checked at Text size M · UI size M on a phone: no text under
 * the type floor (Text size S is the reader's own choice to go smaller), no control's
 * grown hit area taking taps from another control, and none clipped short.
 */
const assertPhoneRules = (scene: string) => {
  const textSize = document.documentElement.dataset.textSize ?? "m";
  if (textSize !== "m" || window.innerWidth > 600) return;
  const roots = [currentContainer, document.getElementById("modal-root")].filter(
    (el): el is HTMLElement => !!el,
  );
  const problems = [
    ...roots.flatMap(textBelowFloor).map((p) => `text under ${TYPE_FLOOR_PX}px: ${p}`),
    ...roots.flatMap(stolenTaps).map((p) => `tap area overlaps a control: ${p}`),
    ...roots.flatMap(clippedTapAreas).map((p) => `tap area is clipped: ${p}`),
  ];
  if (problems.length) {
    throw new Error(`"${scene}" breaks the phone rules:\n  ${problems.join("\n  ")}`);
  }
};

const slug = (name: string) =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

/** Where the review gallery's screenshots go (gitignored); see scripts/visual-gallery.mjs. */
const galleryPath = (scene: string, text: Size, ui: Size, narrow = false) =>
  `${server.config.root}/.vitest/gallery/${slug(scene)}/${narrow ? "narrow__" : ""}text-${text}__ui-${ui}.png`;

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
    // The app mounts in #root, which sets the phone root size (14px under 600px), so
    // scenes render at the sizes the app does.
    container.id = "root";
    // #root is a flex row; stack the scene so it takes the full width, as before.
    container.style.flexDirection = "column";
    // <body> is a flex row; without this the container grows to its content and runs
    // past a phone's width instead of wrapping like the app does.
    container.style.width = "100%";
    container.style.minWidth = "0";
    container.style.alignSelf = "flex-start";
    document.body.appendChild(container);
    root = createRoot(container);
    currentContainer = container;
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
    /** Snapshot for Chromatic. Checks the phone rules first unless `phoneRules` is
     *  false (share cards: fixed-size images, not phone UI). */
    snapshot: async (name: string, { phoneRules = true } = {}) => {
      if (phoneRules) assertPhoneRules(name);
      await takeSnapshot(name);
    },
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
     * width, then NARROW_PAIRS on a narrow phone: each one is saved to the local review
     * gallery (.vitest/gallery/<scene>/), and CHROMATIC_PAIRS plus the narrow L · L are
     * also snapshotted for Chromatic. Render first; the sizes are CSS, so only what reads
     * the prefs re-renders.
     */
    sizes: async (scene: string) => {
      const shoot = async (text: Size, ui: Size, width: number, narrow: boolean) => {
        setSize("textSize", text);
        setSize("uiSize", ui);
        await page.viewport(width, PHONE.height);
        await settle();
        // An open modal is portalled outside the container and fixed to the viewport,
        // so it's shot at a phone's height. Anything else grows the viewport to fit:
        // tests run in an iframe that only paints what's inside it.
        const modalOpen = !!document.getElementById("modal-root")?.childElementCount;
        await page.viewport(
          width,
          modalOpen ? PHONE.height : Math.max(PHONE.height, Math.ceil(container.scrollHeight)),
        );
        await settle();
        if (text === "m" && ui === "m") assertPhoneRules(scene);
        await page.screenshot({
          element: modalOpen ? document.body : container,
          path: galleryPath(scene, text, ui, narrow),
        });
      };
      for (const text of SIZES) {
        for (const ui of SIZES) {
          await shoot(text, ui, PHONE.width, false);
          if (CHROMATIC_PAIRS.some(([t, u]) => t === text && u === ui)) {
            await takeSnapshot(`${scene} · text ${text} · ui ${ui}`);
          }
        }
      }
      for (const [text, ui] of NARROW_PAIRS) {
        await shoot(text, ui, NARROW_PHONE.width, true);
      }
      await takeSnapshot(`${scene} · narrow · text l · ui l`);
    },
  };
};
