import { describe, it, expect, vi, afterEach } from "vite-plus/test";
import { act } from "react";
import { createRoot, Root } from "react-dom/client";
import Modal from "../Modal";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe("a modal with something in flight (disabled)", () => {
  let root: Root;
  afterEach(() => act(() => root.unmount()));

  const render = (onClose: () => void, disabled: boolean) =>
    act(() =>
      root.render(
        <Modal isOpen onClose={onClose} disabled={disabled}>
          <Modal.Header title="saving" showCloseButton />
          <Modal.Actions>
            <Modal.CancelButton />
          </Modal.Actions>
        </Modal>,
      ),
    );
  const escape = () =>
    act(() => {
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    });
  const backdrop = () => document.querySelector<HTMLElement>(".Modal__backdrop")!;
  const clickBackdrop = () => act(() => backdrop().click());

  it("ignores Escape and backdrop clicks, and disables its close and cancel buttons", () => {
    root = createRoot(document.createElement("div"));
    const onClose = vi.fn();
    render(onClose, true);

    escape();
    clickBackdrop();
    expect(onClose).not.toHaveBeenCalled();
    expect(document.querySelector<HTMLButtonElement>(".Modal__button--close")!.disabled).toBe(true);
    expect(document.querySelector<HTMLButtonElement>(".Modal__button--cancel")!.disabled).toBe(
      true,
    );
  });

  it("closes as usual once it settles", () => {
    root = createRoot(document.createElement("div"));
    const onClose = vi.fn();
    render(onClose, true);
    render(onClose, false);

    escape();
    expect(onClose).toHaveBeenCalledTimes(1);
    clickBackdrop();
    expect(onClose).toHaveBeenCalledTimes(2);
  });
});
