import {
  CSSProperties,
  PointerEventHandler,
  ReactNode,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import cx from "classnames";

import { visibleViewportHeight } from "@/utils/keyboardInset";
import { Align, arrowOffset, computePosition, Placement } from "./popoverPosition";
import "./Popover.scss";

type PopoverProps = {
  /** The element the panel attaches to. */
  anchor: HTMLElement | null;
  open: boolean;
  /** Called on Escape and on a press outside both the panel and the anchor. */
  onClose?: () => void;
  placement?: Placement;
  align?: Align;
  /**
   * An element (e.g. a page column) the panel stays inside horizontally, never wider
   * than it. Without one, the panel only keeps to the viewport.
   */
  bounds?: HTMLElement | null;
  /** Tooltips aren't interactive: they ignore the pointer and don't dismiss on outside presses. */
  interactive?: boolean;
  className?: string;
  role?: string;
  "aria-label"?: string;
  onPointerEnter?: PointerEventHandler<HTMLDivElement>;
  onPointerLeave?: PointerEventHandler<HTMLDivElement>;
  children: ReactNode;
};

/**
 * A small panel floating beside an anchor, without dimming the page (for that, use
 * Modal). Rendered in a portal with fixed positioning so overflow-clipped or scrolling
 * containers can't cut it off; it follows its anchor on scroll and resize.
 */
export const Popover = ({
  anchor,
  open,
  onClose,
  placement = "bottom",
  align = "center",
  bounds,
  interactive = true,
  className,
  role,
  "aria-label": ariaLabel,
  onPointerEnter,
  onPointerLeave,
  children,
}: PopoverProps) => {
  const panelRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<{
    top: number;
    left: number;
    side: Placement;
    arrow: number;
    maxWidth?: number;
  }>();

  const update = useCallback(() => {
    const panel = panelRef.current;
    if (!anchor || !panel) return;
    const rect = anchor.getBoundingClientRect();
    const box = bounds?.getBoundingClientRect();
    const placed = computePosition(
      rect,
      { width: panel.offsetWidth, height: panel.offsetHeight },
      // Above the on-screen keyboard, not behind it.
      { width: window.innerWidth, height: visibleViewportHeight() },
      placement,
      align,
      box && { left: box.left, right: box.right },
    );
    setPosition({
      ...placed,
      arrow: arrowOffset(rect, placed.left, panel.offsetWidth),
      maxWidth: box?.width,
    });
  }, [anchor, placement, align, bounds]);

  useLayoutEffect(() => {
    // Positioned before paint, so a reopened panel never shows at its old spot.
    if (!open) return;
    update();
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    // iOS reports the on-screen keyboard only through the visual viewport.
    window.visualViewport?.addEventListener("resize", update);
    // The panel can change size after opening (e.g. the emoji list finishes loading).
    const observer =
      typeof ResizeObserver !== "undefined" ? new ResizeObserver(() => update()) : undefined;
    if (panelRef.current) observer?.observe(panelRef.current);
    return () => {
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
      window.visualViewport?.removeEventListener("resize", update);
      observer?.disconnect();
    };
  }, [open, update]);

  useEffect(() => {
    if (!open || !onClose) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as Node;
      if (panelRef.current?.contains(target) || anchor?.contains(target)) return;
      onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    if (interactive) document.addEventListener("pointerdown", onPointerDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [open, onClose, anchor, interactive]);

  if (!open || !anchor) return null;

  // Measured before it's shown, so it never flashes in the wrong place. Panels with a
  // tail point it at the anchor with --popover-arrow-x (px from the panel's left edge),
  // which stays right when the panel slides sideways to fit on screen.
  const style: CSSProperties = position
    ? ({
        top: position.top,
        left: position.left,
        "--popover-arrow-x": `${position.arrow}px`,
        ...(position.maxWidth !== undefined && { maxWidth: position.maxWidth }),
      } as CSSProperties)
    : { top: 0, left: 0, visibility: "hidden" };

  return createPortal(
    <div
      ref={panelRef}
      className={cx("Popover", position && `Popover--${position.side}`, className, {
        "Popover--passive": !interactive,
        "Popover--inModal": !!anchor.closest("#modal-root"),
      })}
      style={style}
      role={role}
      aria-label={ariaLabel}
      onPointerEnter={onPointerEnter}
      onPointerLeave={onPointerLeave}
    >
      {children}
    </div>,
    document.body,
  );
};

export default Popover;
