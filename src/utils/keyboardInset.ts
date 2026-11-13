/**
 * How much of the bottom of the layout viewport the on-screen keyboard covers, exposed to
 * CSS as `--keyboard-inset` on <html> (see src/tokens.scss).
 *
 * Why: iOS Safari (and WKWebView, so the future native shell) doesn't resize the layout
 * viewport for the keyboard, so `position: fixed; bottom: 0` sheets and `100dvh` boxes sit
 * behind it. The visual viewport does shrink, and the difference is the keyboard. Android
 * Chrome resizes the layout viewport itself (index.html asks for `resizes-content`), so the
 * difference is ~0 there and nothing is counted twice.
 */

/** Below this many px the gap is browser chrome jitter, not a keyboard. */
const MIN_INSET = 40;

export type ViewportMetrics = {
  /** window.innerHeight: the layout viewport. */
  layoutHeight: number;
  /** visualViewport.height */
  visualHeight: number;
  /** visualViewport.offsetTop: how far iOS scrolled the visual viewport to reveal a field. */
  offsetTop: number;
  /** visualViewport.scale: pinch zoom also shrinks the visual viewport. */
  scale: number;
};

/** Pixels hidden under the keyboard, or 0 when there's no keyboard (or the page is zoomed). */
export const computeKeyboardInset = ({
  layoutHeight,
  visualHeight,
  offsetTop,
  scale,
}: ViewportMetrics): number => {
  if (![layoutHeight, visualHeight, offsetTop, scale].every(Number.isFinite)) return 0;
  // Pinch zoom shrinks the visual viewport too; that isn't a keyboard.
  if (scale > 1.01) return 0;
  const inset = Math.round(layoutHeight - visualHeight - offsetTop);
  return inset >= MIN_INSET ? inset : 0;
};

const readMetrics = (): ViewportMetrics | null => {
  const vv = typeof window !== "undefined" ? window.visualViewport : null;
  if (!vv) return null;
  return {
    layoutHeight: window.innerHeight,
    visualHeight: vv.height,
    offsetTop: vv.offsetTop,
    scale: vv.scale,
  };
};

/** The layout-viewport height that isn't under the keyboard, for placing fixed panels. */
export const visibleViewportHeight = (): number => {
  const metrics = readMetrics();
  return window.innerHeight - (metrics ? computeKeyboardInset(metrics) : 0);
};

let started = false;

/** Start tracking the keyboard. Call once at startup, like initTheme. */
export const initKeyboardInset = () => {
  if (started || typeof window === "undefined" || !window.visualViewport) return;
  started = true;
  const vv = window.visualViewport;
  const root = document.documentElement;
  let last = -1;
  let frame = 0;

  const update = () => {
    frame = 0;
    const metrics = readMetrics();
    const inset = metrics ? computeKeyboardInset(metrics) : 0;
    if (inset === last) return;
    last = inset;
    root.style.setProperty("--keyboard-inset", `${inset}px`);
    root.toggleAttribute("data-keyboard-open", inset > 0);
  };
  const schedule = () => {
    if (!frame) frame = requestAnimationFrame(update);
  };

  vv.addEventListener("resize", schedule);
  vv.addEventListener("scroll", schedule);
  window.addEventListener("resize", schedule);
  update();
};
