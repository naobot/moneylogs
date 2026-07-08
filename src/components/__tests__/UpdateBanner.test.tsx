import { describe, it, expect, beforeEach, afterEach, vi } from "vite-plus/test";
import { act } from "react";
import { createRoot, Root } from "react-dom/client";
import UpdateBanner from "@/components/UpdateBanner";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe("UpdateBanner", () => {
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

  const clickByText = (text: string) =>
    act(() => {
      const btn = Array.from(container.querySelectorAll("button")).find(
        (b) => b.textContent === text,
      );
      btn!.click();
    });

  it("renders the message and a refresh action", () => {
    act(() => root.render(<UpdateBanner onRefresh={() => {}} onDismiss={() => {}} />));
    expect(container.textContent).toContain("A new version is available");
    const labels = Array.from(container.querySelectorAll("button")).map((b) => b.textContent);
    expect(labels).toContain("Refresh");
  });

  it("calls onRefresh when Refresh is clicked", () => {
    const onRefresh = vi.fn();
    act(() => root.render(<UpdateBanner onRefresh={onRefresh} onDismiss={() => {}} />));
    clickByText("Refresh");
    expect(onRefresh).toHaveBeenCalledTimes(1);
  });

  it("calls onDismiss when the × is clicked", () => {
    const onDismiss = vi.fn();
    act(() => root.render(<UpdateBanner onRefresh={() => {}} onDismiss={onDismiss} />));
    act(() => {
      container.querySelector<HTMLButtonElement>(".UpdateBanner__dismiss")!.click();
    });
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });
});
