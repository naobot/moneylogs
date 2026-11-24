import { describe, it, expect, afterEach } from "vite-plus/test";
import { act } from "react";
import { createRoot, Root } from "react-dom/client";

import { LoadingDots } from "../LoadingDots";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe("LoadingDots", () => {
  let root: Root | undefined;
  let container: HTMLDivElement;

  const render = (el: React.ReactElement) => {
    container = document.createElement("div");
    root = createRoot(container);
    act(() => root!.render(el));
  };

  afterEach(() => act(() => root?.unmount()));

  it("hides the dots from screen readers and says loading instead", () => {
    render(<LoadingDots />);
    expect(container.querySelector(".LoadingDots__dots")?.getAttribute("aria-hidden")).toBe("true");
    expect(container.querySelector(".sr-only")?.textContent).toBe("loading");
  });

  it("says nothing extra after words that already describe the wait", () => {
    render(<LoadingDots label="" />);
    expect(container.querySelector(".sr-only")).toBeNull();
  });
});
