import { describe, it, expect, beforeEach, afterEach, vi } from "vite-plus/test";
import { act } from "react";
import { createRoot, Root } from "react-dom/client";
import "@/utils/configuredDayjs";
import SpendingChart from "@/features/moneylog/components/LogsSummary/SpendingChart";
import { buildSpendingSeries } from "@/features/moneylog/components/LogsSummary/spendingSeries";
import type { Group, LogPost } from "@/types/user";

const JAN = (day: number) => 1705320000 + (day - 15) * 86400; // Jan 15 12:00 UTC
const group = {
  id: "g1",
  start: { seconds: JAN(15) },
  end: { seconds: JAN(19) },
} as unknown as Group;

const makePost = (amount: number, day: number): LogPost =>
  ({
    id: `p-${day}-${amount}`,
    author: { id: "u1" },
    authorName: "A",
    currency: "CAD",
    amount,
    postDate: { seconds: JAN(day) },
    content: "x",
    groupId: "g1",
  }) as unknown as LogPost;

const points = () =>
  buildSpendingSeries([makePost(100, 16), makePost(40, 18)], group, {
    granularity: "day",
  }).series.get("CAD")!;

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe("SpendingChart", () => {
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

  it("renders a bar and a hit target per bucket in bars mode", () => {
    act(() => root.render(<SpendingChart series={points()} mode="bars" currency="CAD" />));
    expect(container.querySelectorAll(".SpendingChart__bar")).toHaveLength(5);
    expect(container.querySelectorAll(".SpendingChart__hit")).toHaveLength(5);
    expect(container.querySelector(".SpendingChart__axis")).not.toBeNull();
    expect(container.querySelector(".SpendingChart__line")).toBeNull();
  });

  it("renders a line path in cumulative mode", () => {
    act(() => root.render(<SpendingChart series={points()} mode="cumulative" currency="CAD" />));
    const line = container.querySelector<SVGPathElement>(".SpendingChart__line");
    expect(line).not.toBeNull();
    expect(line!.getAttribute("d")).toBeTruthy();
    expect(container.querySelectorAll(".SpendingChart__bar")).toHaveLength(0);
  });

  it("shows a tooltip on hover and fires onSelectPoint on click", () => {
    const onSelect = vi.fn();
    act(() =>
      root.render(
        <SpendingChart series={points()} mode="bars" currency="CAD" onSelectPoint={onSelect} />,
      ),
    );
    const hits = container.querySelectorAll<SVGRectElement>(".SpendingChart__hit");
    // bucket index 1 == Jan 16 (100 CAD)
    act(() => {
      hits[1].dispatchEvent(
        new MouseEvent("mousemove", { bubbles: true, clientX: 10, clientY: 10 }),
      );
    });
    const tooltip = container.querySelector(".SpendingChart__tooltip");
    expect(tooltip).not.toBeNull();
    expect(tooltip!.textContent).toContain("100 CAD");

    act(() => hits[1].dispatchEvent(new MouseEvent("click", { bubbles: true })));
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect.mock.calls[0][0].amount).toBe(100);
  });
});
