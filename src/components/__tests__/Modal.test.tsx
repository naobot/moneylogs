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

  it("renders the solid title bar by default", () => {
    act(() =>
      root.render(
        <Modal isOpen onClose={() => {}}>
          <Modal.Header title="Warning" />
        </Modal>,
      ),
    );
    expect(header().classList.contains("Modal__header--striped")).toBe(false);
    expect(header().querySelector(".Modal__header__fill")).toBeNull();
  });

  it("renders striped chrome with a decorative fill when asked", () => {
    act(() =>
      root.render(
        <Modal isOpen onClose={() => {}}>
          <Modal.Header striped title="Categories" />
        </Modal>,
      ),
    );
    expect(header().classList.contains("Modal__header--striped")).toBe(true);
    const fill = header().querySelector(".Modal__header__fill")!;
    expect(fill.classList.contains("tex-stripe")).toBe(true);
    expect(fill.getAttribute("aria-hidden")).toBe("true");
    expect(header().querySelector(".Modal__title")!.textContent).toBe("Categories");
  });
});
