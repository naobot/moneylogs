import { describe, it, expect, beforeEach, afterEach } from "vite-plus/test";
import { act } from "react";
import { createRoot, Root } from "react-dom/client";
import "@/utils/configuredDayjs";
import SpendingPanel from "@/features/moneylog/components/LogsSummary/SpendingPanel";
import type { Group, LogPost } from "@/types/user";

// Noon-UTC timestamps so day bucketing is stable regardless of the runner's tz.
const JAN = (day: number) => 1705320000 + (day - 15) * 86400; // Jan 15 12:00 UTC
const group = {
  id: "g1",
  title: "Test Group",
  start: { seconds: JAN(15) },
  end: { seconds: JAN(19) },
} as unknown as Group;

const makePost = (amount: number, day: number, currency = "CAD", author = "u1"): LogPost =>
  ({
    id: `p-${currency}-${day}-${amount}`,
    author: { id: author },
    authorName: author,
    currency,
    amount,
    postDate: { seconds: JAN(day) },
    content: "x",
    groupId: "g1",
  }) as unknown as LogPost;

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe("SpendingPanel", () => {
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

  const gridText = () => container.querySelector(".SpendingInsights__grid")?.textContent ?? "";
  const clickButton = (label: string) =>
    act(() => {
      const btn = Array.from(container.querySelectorAll("button")).find(
        (b) => b.textContent === label,
      );
      btn!.click();
    });

  it("shows an empty state when there is no spending", () => {
    act(() => root.render(<SpendingPanel scope="mine" user={{}} logPosts={[]} group={group} />));
    expect(container.querySelector(".SpendingPanel__empty")).not.toBeNull();
    expect(container.textContent).toContain("No spending was logged");
  });

  it("shows a loading state instead of the empty message while posts are loading", () => {
    act(() =>
      root.render(<SpendingPanel scope="mine" user={{}} logPosts={[]} group={group} isLoading />),
    );
    expect(container.querySelector(".SpendingPanel__loading")).not.toBeNull();
    expect(container.textContent).not.toContain("No spending was logged");
  });

  it("phrases group insights as 'the group', not 'this user'", () => {
    act(() =>
      root.render(
        <SpendingPanel scope="group" user={{}} logPosts={[makePost(100, 16)]} group={group} />,
      ),
    );
    const text = gridText();
    expect(text).toContain("the group's average");
    expect(text).toContain("The group logged");
    expect(text).not.toContain("This user");
    expect(text).not.toContain("You logged");
  });

  it("phrases my insights in the second person", () => {
    act(() =>
      root.render(
        <SpendingPanel scope="mine" user={{}} logPosts={[makePost(100, 16)]} group={group} />,
      ),
    );
    const text = gridText();
    expect(text).toContain("your average");
    expect(text).toContain("You logged");
    expect(text).not.toContain("the group");
  });

  it("shows only the active currency's cards and switches with the selector", () => {
    // CAD total 300 (highest → default active), USD total 100
    const logPosts = [makePost(100, 16, "CAD"), makePost(200, 17, "CAD"), makePost(100, 16, "USD")];
    act(() =>
      root.render(<SpendingPanel scope="mine" user={{}} logPosts={logPosts} group={group} />),
    );

    // Default: highest-total currency (CAD) only
    expect(gridText()).toContain("CAD");
    expect(gridText()).not.toContain("USD");

    // A currency selector is present for multi-currency groups
    const currencyButtons = Array.from(container.querySelectorAll("button")).map(
      (b) => b.textContent,
    );
    expect(currencyButtons).toContain("CAD");
    expect(currencyButtons).toContain("USD");

    // Switching currency swaps which cards' figures are shown
    clickButton("USD");
    expect(gridText()).toContain("USD");
    expect(gridText()).not.toContain("CAD");
  });

  it("omits the currency selector when there is a single currency", () => {
    act(() =>
      root.render(
        <SpendingPanel
          scope="mine"
          user={{}}
          logPosts={[makePost(100, 16), makePost(50, 17)]}
          group={group}
        />,
      ),
    );
    const labels = Array.from(container.querySelectorAll("button")).map((b) => b.textContent);
    // mode toggle only — no currency chips
    expect(labels).toContain("bars");
    expect(labels).not.toContain("CAD");
  });
});
