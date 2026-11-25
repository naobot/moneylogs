import { describe, it, expect, beforeEach, afterEach, vi } from "vite-plus/test";
import { act } from "react";
import { createRoot, Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { LedgerCategory } from "@/types/ledger";

vi.mock("@/hooks/useGetMyLedgers", () => ({
  useGetMyLedgers: () => ({ ledgers: [{ id: "biz", parentLink: { linkId: "L-biz" } }] }),
}));

import LedgerSidebar from "../LedgerSidebar";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const PLAIN: LedgerCategory[] = [{ id: "food", name: "food", order: 0 }];
const WITH_SUBLOG: LedgerCategory[] = [
  ...PLAIN,
  { id: "sublog-biz", name: "business", order: 1, sublog: { linkId: "L-biz" } },
];

describe("LedgerSidebar", () => {
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

  const render = (categories: LedgerCategory[], onAddSublog?: () => void) =>
    act(() =>
      root.render(
        <MemoryRouter>
          <LedgerSidebar
            ledgerId="personal"
            categories={categories}
            view="entries"
            period={{ kind: "month", key: "2026-11" }}
            currentMonth="2026-11"
            onAddSublog={onAddSublog}
          />
        </MemoryRouter>,
      ),
    );
  const addButton = () =>
    Array.from(container.querySelectorAll("button")).find((b) => b.textContent === "+ sublog");

  it("offers + sublog on a log with no sublogs", () => {
    const onAddSublog = vi.fn();
    render(PLAIN, onAddSublog);
    act(() => addButton()!.click());
    expect(onAddSublog).toHaveBeenCalledTimes(1);
  });

  it("lists the sublogs instead once there are some", () => {
    render(WITH_SUBLOG, vi.fn());
    expect(addButton()).toBeUndefined();
    expect(container.textContent).toContain("business");
  });

  it("shows nothing for a log that can't have sublogs", () => {
    render(PLAIN);
    expect(addButton()).toBeUndefined();
  });
});
