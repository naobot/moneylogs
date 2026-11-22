import { describe, it, expect, vi, afterEach } from "vite-plus/test";
import { act } from "react";
import { createRoot, Root } from "react-dom/client";
import Modal from "../Modal";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe("stacked modals", () => {
  let root: Root;
  afterEach(() => act(() => root.unmount()));

  const render = (outer: () => void, inner: () => void, innerOpen: boolean) =>
    act(() =>
      root.render(
        <>
          <Modal isOpen onClose={outer}>
            <p>outer</p>
          </Modal>
          <Modal isOpen={innerOpen} onClose={inner}>
            <p>inner</p>
          </Modal>
        </>,
      ),
    );
  const escape = () =>
    act(() => {
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    });

  it("closes only the top one on Escape, and keeps the page locked under the other", () => {
    root = createRoot(document.createElement("div"));
    const outer = vi.fn();
    const inner = vi.fn();
    render(outer, inner, true);
    expect(document.body.style.overflow).toBe("hidden");

    escape();
    expect(inner).toHaveBeenCalledTimes(1);
    expect(outer).not.toHaveBeenCalled();

    // The top one closes: the page stays locked, and Escape now reaches the other.
    render(outer, inner, false);
    expect(document.body.style.overflow).toBe("hidden");
    escape();
    expect(outer).toHaveBeenCalledTimes(1);
  });

  it("unlocks the page once the last one closes", () => {
    root = createRoot(document.createElement("div"));
    render(vi.fn(), vi.fn(), true);
    act(() => root.render(<></>));
    expect(document.body.style.overflow).toBe("unset");
  });
});

describe("a modal opened inside another", () => {
  let root: Root;
  afterEach(() => act(() => root.unmount()));

  it("is the top one even when both open in the same render", () => {
    root = createRoot(document.createElement("div"));
    const outer = vi.fn();
    const inner = vi.fn();
    act(() =>
      root.render(
        <Modal isOpen onClose={outer}>
          <p>manage</p>
          <Modal isOpen onClose={inner}>
            <p>intro</p>
          </Modal>
        </Modal>,
      ),
    );
    act(() => {
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    });
    expect(inner).toHaveBeenCalledTimes(1);
    expect(outer).not.toHaveBeenCalled();
    // And it's drawn above the other.
    const backdrops = Array.from(document.querySelectorAll<HTMLElement>(".Modal__backdrop"));
    const inside = backdrops.find((b) => b.textContent === "intro")!;
    const outside = backdrops.find((b) => b.textContent?.startsWith("manage"))!;
    const z = (el: HTMLElement) => Number(el.style.zIndex || 0);
    const above =
      z(inside) > z(outside) ||
      (z(inside) === z(outside) &&
        !!(outside.compareDocumentPosition(inside) & Node.DOCUMENT_POSITION_FOLLOWING));
    expect(above).toBe(true);
  });
});
