import { describe, it, expect, beforeEach, afterEach, vi } from "vite-plus/test";
import { act } from "react";
import { createRoot, Root } from "react-dom/client";
import RowButton from "@/components/RowButton";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe("RowButton", () => {
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

  const button = () => container.querySelector<HTMLButtonElement>("button")!;

  it("renders a type=button with the shared class", () => {
    act(() => root.render(<RowButton>manage</RowButton>));
    expect(button().className).toBe("RowButton");
    expect(button().type).toBe("button");
    expect(button().textContent).toBe("manage");
  });

  it("adds the glyph modifier and keeps extra classes", () => {
    act(() =>
      root.render(
        <RowButton glyph aria-label="Next month" className="Extra">
          ›
        </RowButton>,
      ),
    );
    expect(button().classList.contains("RowButton--glyph")).toBe(true);
    expect(button().classList.contains("Extra")).toBe(true);
    expect(button().getAttribute("aria-label")).toBe("Next month");
  });

  it("forwards clicks and respects disabled", () => {
    const onClick = vi.fn();
    act(() => root.render(<RowButton onClick={onClick}>edit</RowButton>));
    act(() => button().click());
    expect(onClick).toHaveBeenCalledTimes(1);

    act(() =>
      root.render(
        <RowButton onClick={onClick} disabled>
          edit
        </RowButton>,
      ),
    );
    act(() => button().click());
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
