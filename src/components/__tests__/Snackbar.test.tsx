import { describe, it, expect, vi, beforeEach, afterEach } from "vite-plus/test";
import { act } from "react";
import { createRoot, Root } from "react-dom/client";
import { Snackbar } from "@/components/ToastContainer";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const toast = (variant: "error" | "success") => ({
  id: "1",
  message: "Saved",
  variant,
  timestamp: new Date("2026-11-23T09:00:00Z"),
});

describe("Snackbar", () => {
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
  });

  it("dismisses the toast when ok is pressed", () => {
    const onRemove = vi.fn();
    act(() => root.render(<Snackbar toasts={[toast("success")]} onRemove={onRemove} />));

    const ok = container.querySelector("button");
    expect(ok?.textContent).toBe("ok");
    act(() => ok?.click());

    expect(onRemove).toHaveBeenCalledWith("1");
  });

  it("announces errors as alerts and successes as status", () => {
    act(() => root.render(<Snackbar toasts={[toast("error")]} onRemove={() => {}} />));
    expect(container.querySelector("[role=alert]")).not.toBeNull();

    act(() => root.render(<Snackbar toasts={[toast("success")]} onRemove={() => {}} />));
    expect(container.querySelector("[role=status]")).not.toBeNull();
  });
});
