/** Pure placement maths for Popover, kept apart so it can be unit tested. */

export type Placement = "top" | "bottom";
export type Align = "start" | "center" | "end";

type Rect = { top: number; bottom: number; left: number; right: number; width: number };
type Size = { width: number; height: number };

const GAP = 6; // between anchor and panel
const MARGIN = 8; // kept clear of the viewport edges

/**
 * Where to put a panel of `panel` size next to `anchor`, preferring `placement` but
 * flipping when the other side has more room, and sliding sideways to stay on screen.
 */
export const computePosition = (
  anchor: Rect,
  panel: Size,
  viewport: Size,
  placement: Placement = "bottom",
  align: Align = "center",
): { top: number; left: number; side: Placement } => {
  const below = viewport.height - anchor.bottom - GAP - MARGIN;
  const above = anchor.top - GAP - MARGIN;
  let side = placement;
  if (side === "bottom" && panel.height > below && above > below) side = "top";
  else if (side === "top" && panel.height > above && below > above) side = "bottom";

  const top = side === "bottom" ? anchor.bottom + GAP : anchor.top - GAP - panel.height;
  const preferredLeft =
    align === "start"
      ? anchor.left
      : align === "end"
        ? anchor.right - panel.width
        : anchor.left + anchor.width / 2 - panel.width / 2;
  const maxLeft = viewport.width - panel.width - MARGIN;
  const left = Math.max(MARGIN, Math.min(preferredLeft, maxLeft));
  return { top: Math.max(MARGIN, top), left, side };
};

const ARROW_INSET = 12; // keeps an arrow clear of the panel's square corners

/**
 * Where along a placed panel's width (px from its left edge) an arrow should sit to point
 * at the anchor's centre, kept off the panel's corners when the panel has slid sideways.
 */
export const arrowOffset = (anchor: Rect, panelLeft: number, panelWidth: number): number => {
  const target = anchor.left + anchor.width / 2 - panelLeft;
  return Math.max(ARROW_INSET, Math.min(target, panelWidth - ARROW_INSET));
};

/** A panel centred over its anchor (no arrow), slid as needed to stay on screen. */
export const computeCenteredPosition = (
  anchor: Rect & { height?: number },
  panel: Size,
  viewport: Size,
): { top: number; left: number } => {
  const anchorHeight = anchor.height ?? anchor.bottom - anchor.top;
  const left = anchor.left + anchor.width / 2 - panel.width / 2;
  const top = anchor.top + anchorHeight / 2 - panel.height / 2;
  return {
    left: Math.max(MARGIN, Math.min(left, viewport.width - panel.width - MARGIN)),
    top: Math.max(MARGIN, Math.min(top, viewport.height - panel.height - MARGIN)),
  };
};
