import { describe, it, expect, beforeEach, afterEach } from "vite-plus/test";
import { act } from "react";
import { createRoot, Root } from "react-dom/client";
import Modal from "@/components/Modal";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe("Modal.Header", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    document.getElementById("modal-root")?.remove();
  });

  const header = () => document.querySelector(".Modal__header")!;

  it("is always the black bar, with no striped chrome", () => {
    act(() =>
      root.render(
        <Modal isOpen onClose={() => {}}>
          <Modal.Header title="Categories" />
        </Modal>,
      ),
    );
    expect(header().className.trim()).toBe("Modal__header");
    expect(header().querySelector(".tex-stripe")).toBeNull();
    expect(header().querySelector(".Modal__title")!.textContent).toBe("Categories");
  });

  it("closes from its × button, which never submits a form", () => {
    let closed = 0;
    act(() =>
      root.render(
        <Modal isOpen onClose={() => (closed += 1)}>
          <Modal.Header title="Categories" showCloseButton />
        </Modal>,
      ),
    );
    const close = header().querySelector<HTMLButtonElement>(".Modal__button--close")!;
    expect(close.type).toBe("button");
    expect(close.getAttribute("aria-label")).toBe("Close modal");
    act(() => close.click());
    expect(closed).toBe(1);
  });
});
