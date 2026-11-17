import { describe, it, expect, beforeEach, afterEach } from "vite-plus/test";
import { act } from "react";
import { createRoot, Root } from "react-dom/client";
import Button from "@/components/Button";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe("Button", () => {
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

  const render = (ui: React.ReactNode) => act(() => root.render(ui));
  const button = () => container.querySelector("button")!;

  it("is a framed primary action by default, at md size", () => {
    render(<Button text="Save" />);
    expect(button().classList).toContain("Button--primary");
    expect(button().classList).toContain("Button--size-md");
    expect(button().hasAttribute("aria-pressed")).toBe(false);
  });

  it.each(["secondary", "toggle", "icon"] as const)(
    "maps the %s variant to its class",
    (variant) => {
      render(<Button text="x" variant={variant} />);
      expect(button().classList).toContain(`Button--${variant}`);
      expect(button().classList).not.toContain("Button--primary");
    },
  );

  it("fills a selected toggle and reports it as pressed", () => {
    render(<Button text="daily" variant="toggle" isSelected />);
    expect(button().classList).toContain("Button--active");
    expect(button().getAttribute("aria-pressed")).toBe("true");

    render(<Button text="daily" variant="toggle" />);
    expect(button().classList).not.toContain("Button--active");
    expect(button().getAttribute("aria-pressed")).toBe("false");
  });

  it("ignores isSelected outside toggles, so filled only ever means selected", () => {
    render(<Button text="Save" isSelected />);
    expect(button().classList).not.toContain("Button--active");
    expect(button().hasAttribute("aria-pressed")).toBe(false);
  });
});
