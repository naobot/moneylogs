import { describe, it, expect, beforeEach, afterEach } from "vite-plus/test";
import { act } from "react";
import { createRoot, Root } from "react-dom/client";
import { takeSnapshot } from "@chromatic-com/vitest";
import Button from "@/components/Button";
import "@/index.css";
import "@/App.scss";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe("Button (visual)", () => {
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

  it("renders each style and state", async () => {
    act(() =>
      root.render(
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem", padding: "1rem" }}>
          <Button text="primary" />
          <Button text="bordered" buttonStyle="primary-border" />
          <Button text="lite" buttonStyle="primary-border-lite" />
          <Button text="selected" isSelected />
          <Button text="disabled" disabled />
          <Button text="small" size="sm" />
          <Button text="large" size="lg" />
        </div>,
      ),
    );

    expect(container.querySelectorAll("button")).toHaveLength(7);
    // Snapshot before afterEach unmounts; auto-snapshots are off in vitest.config.ts.
    await takeSnapshot("button variants");
  });
});
