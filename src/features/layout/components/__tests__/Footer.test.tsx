import { describe, it, expect, beforeEach, afterEach, vi } from "vite-plus/test";
import { act } from "react";
import { createRoot, Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";

const state = vi.hoisted(() => ({ native: false }));
vi.mock("@/platform", () => ({ isNative: () => state.native }));

import Footer from "../Footer";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe("Footer", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    state.native = false;
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  const render = () =>
    act(() =>
      root.render(
        <MemoryRouter>
          <Footer />
        </MemoryRouter>,
      ),
    );

  it("offers the tip link on the web", () => {
    render();
    expect(container.textContent).toContain("support me?");
    expect(container.textContent).toContain("privacy");
  });

  it("leaves the tip link out of the store apps", () => {
    state.native = true;
    render();
    expect(container.textContent).not.toContain("support me?");
    expect(container.textContent).toContain("nnao.world");
    expect(container.textContent).toContain("privacy");
  });
});
