import { describe, it, expect } from "vite-plus/test";
import {
  arrowOffset,
  computeCenteredPosition,
  computePosition,
} from "@/components/popoverPosition";

const viewport = { width: 400, height: 800 };
const anchorAt = (top: number, left: number, width = 20, height = 20) => ({
  top,
  left,
  bottom: top + height,
  right: left + width,
  width,
});
const panel = { width: 200, height: 100 };

describe("computePosition", () => {
  it("places the panel below, centred on the anchor", () => {
    expect(computePosition(anchorAt(100, 190), panel, viewport)).toEqual({
      top: 126,
      left: 100,
      side: "bottom",
    });
  });

  it("aligns to the anchor's right edge with align=end", () => {
    expect(computePosition(anchorAt(100, 300), panel, viewport, "bottom", "end").left).toBe(120);
  });

  it("flips above when there isn't room below", () => {
    const result = computePosition(anchorAt(750, 190), panel, viewport, "bottom");
    expect(result.side).toBe("top");
    expect(result.top).toBe(750 - 6 - 100);
  });

  it("flips below when there isn't room above", () => {
    expect(computePosition(anchorAt(20, 190), panel, viewport, "top").side).toBe("bottom");
  });

  it("keeps the panel inside the viewport horizontally", () => {
    expect(computePosition(anchorAt(100, 390), panel, viewport, "bottom", "start").left).toBe(192);
    expect(computePosition(anchorAt(100, 0), panel, viewport, "bottom", "end").left).toBe(8);
  });
});

describe("arrowOffset", () => {
  const anchor = { top: 0, bottom: 20, left: 100, right: 140, width: 40 };

  it("points at the anchor's centre", () => {
    expect(arrowOffset(anchor, 50, 200)).toBe(70);
  });

  it("stays off the corners when the panel slid far to one side", () => {
    expect(arrowOffset(anchor, 130, 200)).toBe(12);
    expect(arrowOffset({ ...anchor, left: 390, right: 400, width: 10 }, 0, 200)).toBe(188);
  });
});

describe("computeCenteredPosition", () => {
  const viewport = { width: 400, height: 800 };
  const panel = { width: 200, height: 100 };

  it("centres over the anchor", () => {
    const anchor = { top: 300, bottom: 400, left: 100, right: 300, width: 200 };
    expect(computeCenteredPosition(anchor, panel, viewport)).toEqual({ top: 300, left: 100 });
  });

  it("stays on screen", () => {
    const anchor = { top: 0, bottom: 20, left: 380, right: 400, width: 20 };
    expect(computeCenteredPosition(anchor, panel, viewport)).toEqual({ top: 8, left: 192 });
  });
});
