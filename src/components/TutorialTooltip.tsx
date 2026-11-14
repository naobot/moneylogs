import { CSSProperties, MouseEvent, useCallback, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import cx from "classnames";

import { visibleViewportHeight } from "@/utils/keyboardInset";
import { arrowOffset, computeCenteredPosition, computePosition } from "./popoverPosition";

type Props = {
  text: string;
  onDismiss: () => void;
  /** Below, above, or centred over the element it's rendered inside (its anchor). */
  position?: "top" | "bottom" | "center";
  /** Prefer lining up with an edge of the anchor instead of centring on it. */
  align?: "center" | "start" | "end";
  /** e.g. "2/9", for multi-step tours. */
  progress?: string;
  /** The small line under the text. */
  hint?: string;
  /** Shows a "skip tour" control that ends the whole tour. */
  onSkip?: () => void;
};

type Placed = { top: number; left: number; side: "top" | "bottom" | "center"; arrow?: number };

/**
 * A tutorial speech bubble pointing at the element it's rendered inside. It's drawn in a
 * portal with fixed positioning, so no stacking context or overflow-clipped container can
 * bury or crop it, and it slides sideways (arrow still on target) to stay on screen.
 */
const TutorialTooltip = ({
  text,
  onDismiss,
  position = "bottom",
  align = "center",
  progress,
  hint = "tap to dismiss",
  onSkip,
}: Props) => {
  // An inert marker left in place, so the bubble knows which element it belongs to.
  const markerRef = useRef<HTMLSpanElement>(null);
  const bubbleRef = useRef<HTMLDivElement>(null);
  const [placed, setPlaced] = useState<Placed>();

  const update = useCallback(() => {
    const anchor = markerRef.current?.parentElement;
    const bubble = bubbleRef.current;
    if (!anchor || !bubble) return;
    const rect = anchor.getBoundingClientRect();
    const size = { width: bubble.offsetWidth, height: bubble.offsetHeight };
    const viewport = { width: window.innerWidth, height: visibleViewportHeight() };
    if (position === "center") {
      setPlaced({ ...computeCenteredPosition(rect, size, viewport), side: "center" });
      return;
    }
    const { top, left, side } = computePosition(rect, size, viewport, position, align);
    setPlaced({ top, left, side, arrow: arrowOffset(rect, left, size.width) });
  }, [position, align]);

  useLayoutEffect(() => {
    update();
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    window.visualViewport?.addEventListener("resize", update);
    // The anchor moves when the layout around it does (e.g. the editor opening).
    const observer =
      typeof ResizeObserver !== "undefined" ? new ResizeObserver(() => update()) : undefined;
    const anchor = markerRef.current?.parentElement;
    if (anchor) observer?.observe(anchor);
    if (bubbleRef.current) observer?.observe(bubbleRef.current);
    return () => {
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
      window.visualViewport?.removeEventListener("resize", update);
      observer?.disconnect();
    };
  }, [update, text]);

  const handleClick = (e: MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    onDismiss();
  };

  const handleSkip = (e: MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    onSkip?.();
  };

  // Measured before it's shown, so it never flashes in the wrong place.
  const style: CSSProperties = placed
    ? ({
        top: placed.top,
        left: placed.left,
        "--tooltip-arrow-x": placed.arrow !== undefined ? `${placed.arrow}px` : undefined,
      } as CSSProperties)
    : { top: 0, left: 0, visibility: "hidden" };

  return (
    <>
      <span ref={markerRef} hidden />
      {createPortal(
        <div
          ref={bubbleRef}
          className={cx("TutorialTooltip", `TutorialTooltip--${placed?.side ?? position}`)}
          style={style}
          onClick={handleClick}
          role="tooltip"
        >
          <span>{text}</span>
          <small>
            {progress && <>{progress} · </>}
            {hint}
            {onSkip && (
              <>
                {" · "}
                <button type="button" className="TutorialTooltip__skip" onClick={handleSkip}>
                  skip tour
                </button>
              </>
            )}
          </small>
        </div>,
        document.body,
      )}
    </>
  );
};

export default TutorialTooltip;
