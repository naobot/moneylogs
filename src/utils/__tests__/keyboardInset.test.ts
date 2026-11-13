import { describe, it, expect } from "vite-plus/test";
import { computeKeyboardInset } from "../keyboardInset";

const base = { layoutHeight: 800, visualHeight: 800, offsetTop: 0, scale: 1 };

describe("computeKeyboardInset", () => {
  it("is 0 with no keyboard", () => {
    expect(computeKeyboardInset(base)).toBe(0);
  });

  it("measures the keyboard when the visual viewport shrinks (iOS)", () => {
    expect(computeKeyboardInset({ ...base, visualHeight: 460 })).toBe(340);
  });

  it("subtracts how far the visual viewport was scrolled to reveal a field", () => {
    expect(computeKeyboardInset({ ...base, visualHeight: 460, offsetTop: 120 })).toBe(220);
  });

  it("ignores small gaps from collapsing browser chrome", () => {
    expect(computeKeyboardInset({ ...base, visualHeight: 770 })).toBe(0);
  });

  it("is 0 when the layout viewport already resized (Android resizes-content)", () => {
    expect(computeKeyboardInset({ ...base, layoutHeight: 460, visualHeight: 460 })).toBe(0);
  });

  it("is 0 while pinch-zoomed", () => {
    expect(computeKeyboardInset({ ...base, visualHeight: 400, scale: 2 })).toBe(0);
  });

  it("never goes negative and tolerates bad input", () => {
    expect(computeKeyboardInset({ ...base, visualHeight: 900 })).toBe(0);
    expect(computeKeyboardInset({ ...base, visualHeight: NaN })).toBe(0);
  });
});
