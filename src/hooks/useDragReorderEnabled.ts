import { useEffect, useState } from "react";

// Keep in sync with $breakpoint-md in constants.scss — at or below this width the
// LogsMenu renders as a horizontal bar, where drag-to-reorder doesn't make sense.
const HORIZONTAL_NAV_MAX_WIDTH = 768;

const HORIZONTAL_NAV_QUERY = `(max-width: ${HORIZONTAL_NAV_MAX_WIDTH}px)`;
const COARSE_POINTER_QUERY = "(any-pointer: coarse)";
const FINE_POINTER_QUERY = "(any-pointer: fine)";

// Drag-to-reorder is enabled only when there's room for the vertical nav and the
// device has a precise pointer. It's disabled when the nav is horizontal (small
// screens) or on touch-only devices, where drag competes with tap/scroll gestures.
// A touch-only device exposes a coarse pointer but no fine one; hybrid laptops
// (touchscreen + trackpad/mouse) also expose a fine pointer, so they keep drag.
const evaluateDragEnabled = () => {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return false;
  }
  const isHorizontalNav = window.matchMedia(HORIZONTAL_NAV_QUERY).matches;
  const isTouchOnly =
    window.matchMedia(COARSE_POINTER_QUERY).matches &&
    !window.matchMedia(FINE_POINTER_QUERY).matches;
  return !isHorizontalNav && !isTouchOnly;
};

const useDragReorderEnabled = () => {
  const [enabled, setEnabled] = useState(evaluateDragEnabled);

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
      return;
    }

    const update = () => setEnabled(evaluateDragEnabled());
    const queries = [
      window.matchMedia(HORIZONTAL_NAV_QUERY),
      window.matchMedia(COARSE_POINTER_QUERY),
      window.matchMedia(FINE_POINTER_QUERY),
    ];

    queries.forEach((query) => query.addEventListener("change", update));

    // Re-evaluate on mount in case the environment changed since first render.
    update();

    return () => {
      queries.forEach((query) => query.removeEventListener("change", update));
    };
  }, []);

  return enabled;
};

export default useDragReorderEnabled;
