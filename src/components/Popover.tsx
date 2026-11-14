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
import { Align, computePosition, Placement } from "./popoverPosition";
import "./Popover.scss";

type PopoverProps = {
  /** The element the panel attaches to. */
  anchor: HTMLElement | null;
  open: boolean;
  /** Called on Escape and on a press outside both the panel and the anchor. */
  onClose?: () => void;
  placement?: Placement;
  align?: Align;
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
  interactive = true,
  className,
  role,
  "aria-label": ariaLabel,
  onPointerEnter,
  onPointerLeave,
  children,
}: PopoverProps) => {
  const panelRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<{ top: number; left: number; side: Placement }>();

  const update = useCallback(() => {
    const panel = panelRef.current;
    if (!anchor || !panel) return;
    setPosition(
      computePosition(
        anchor.getBoundingClientRect(),
        { width: panel.offsetWidth, height: panel.offsetHeight },
        // Above the on-screen keyboard, not behind it.
        { width: window.innerWidth, height: visibleViewportHeight() },
        placement,
        align,
      ),
    );
  }, [anchor, placement, align]);

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

  // Measured before it's shown, so it never flashes in the wrong place.
  const style: CSSProperties = position
    ? { top: position.top, left: position.left }
    : { top: 0, left: 0, visibility: "hidden" };

  return createPortal(
    <div
      ref={panelRef}
      className={cx("Popover", position && `Popover--${position.side}`, className, {
        "Popover--passive": !interactive,
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
