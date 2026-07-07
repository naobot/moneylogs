import { describe, it, expect, beforeEach, afterEach, vi } from "vite-plus/test";
import { act } from "react";
import { createRoot, Root } from "react-dom/client";
import Tabs from "@/components/Tabs";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const TABS = [
  { id: "mine", label: "My spending" },
  { id: "group", label: "Group spending" },
];

describe("Tabs", () => {
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

  it("renders a tab per item and marks the active one", () => {
    act(() => root.render(<Tabs tabs={TABS} activeId="group" onChange={() => {}} />));

    const tabs = container.querySelectorAll<HTMLButtonElement>("[role='tab']");
    expect(tabs).toHaveLength(2);

    const active = container.querySelector(".Tabs__tab--active");
    expect(active?.textContent).toBe("Group spending");
    expect(active?.getAttribute("aria-selected")).toBe("true");

    const inactive = Array.from(tabs).find((t) => t.textContent === "My spending")!;
    expect(inactive.getAttribute("aria-selected")).toBe("false");
    expect(inactive.className).not.toContain("Tabs__tab--active");
  });

  it("calls onChange with the clicked tab's id", () => {
    const onChange = vi.fn();
    act(() => root.render(<Tabs tabs={TABS} activeId="mine" onChange={onChange} />));

    const groupTab = Array.from(container.querySelectorAll<HTMLButtonElement>("[role='tab']")).find(
      (t) => t.textContent === "Group spending",
    )!;
    act(() => groupTab.click());

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith("group");
  });
});
