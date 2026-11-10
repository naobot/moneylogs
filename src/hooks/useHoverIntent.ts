import { PointerEvent, useEffect, useMemo, useRef } from "react";

// Hover popovers wait a beat before opening, so passing the pointer over doesn't flash
// them. They linger briefly on leave, so the pointer can cross the gap to the panel.
export const HOVER_OPEN_DELAY = 350;
export const HOVER_CLOSE_DELAY = 200;

/** Hover-to-preview only makes sense with a real pointer; touch goes straight to click. */
export const isMousePointer = (e: Pick<PointerEvent, "pointerType">) => e.pointerType === "mouse";

/**
 * Delayed open/close timers for hover popovers. Each call replaces a pending timer of
 * the same kind, and both are cleared on unmount.
 */
export const useHoverIntent = ({
  openDelay = HOVER_OPEN_DELAY,
  closeDelay = HOVER_CLOSE_DELAY,
}: { openDelay?: number; closeDelay?: number } = {}) => {
  const openTimer = useRef<ReturnType<typeof setTimeout>>();
  const closeTimer = useRef<ReturnType<typeof setTimeout>>();

  useEffect(
    () => () => {
      clearTimeout(openTimer.current);
      clearTimeout(closeTimer.current);
    },
    [],
  );

  return useMemo(
    () => ({
      openAfterDelay: (open: () => void) => {
        clearTimeout(openTimer.current);
        openTimer.current = setTimeout(open, openDelay);
      },
      cancelOpen: () => clearTimeout(openTimer.current),
      closeAfterDelay: (close: () => void) => {
        clearTimeout(closeTimer.current);
        closeTimer.current = setTimeout(close, closeDelay);
      },
      cancelClose: () => clearTimeout(closeTimer.current),
    }),
    [openDelay, closeDelay],
  );
};
