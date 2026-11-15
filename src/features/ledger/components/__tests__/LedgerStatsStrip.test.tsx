import { describe, it, expect, beforeEach, afterEach, vi } from "vite-plus/test";
import { act } from "react";
import { createRoot, Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { LedgerStatsStrip } from "@/features/ledger/components/LedgerStats";
import { Ledger, LedgerCategory, LedgerEntry } from "@/types/ledger";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const ledgerWith = (categories: LedgerCategory[]) =>
  ({
    id: "l1",
    title: "Money",
    max_participants: 1,
    members: [],
    memberUids: ["u1"],
    categories,
    defaultCurrency: "JPY",
  }) as unknown as Ledger;

const ENTRIES = [
  {
    id: "e1",
    amount: 1000,
    currency: "JPY",
    categoryId: "food",
    date: "2026-11-03",
    authorUid: "u1",
  },
] as unknown as LedgerEntry[];

describe("LedgerStatsStrip", () => {
  let container: HTMLDivElement;
  let root: Root;
  let onEditBudget: ReturnType<typeof vi.fn<() => void>>;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    onEditBudget = vi.fn<() => void>();
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  const render = (categories: LedgerCategory[]) =>
    act(() =>
      root.render(
        <MemoryRouter>
          <LedgerStatsStrip
            ledger={ledgerWith(categories)}
            month="2026-11"
            today="2026-11-15"
            entries={ENTRIES}
            isLoading={false}
            onEditBudget={onEditBudget}
          />
        </MemoryRouter>,
      ),
    );
  const buttons = () => Array.from(container.querySelectorAll("button"));

  it("invites setting a budget when there is none", () => {
    render([{ id: "food", name: "Food", order: 0 }]);
    const cta = buttons().find((b) => b.textContent === "set budget")!;
    act(() => cta.click());
    expect(onEditBudget).toHaveBeenCalled();
  });

  it("shows budget progress, which opens the budgets editor", () => {
    render([{ id: "food", name: "Food", order: 0, budget: { JPY: 4000 } }]);
    expect(container.textContent).not.toContain("set budget");
    const status = buttons().find((b) => b.textContent?.includes("budget"))!;
    expect(status.textContent).toMatch(/25%.*4,000 JPY budget/);
    act(() => status.click());
    expect(onEditBudget).toHaveBeenCalled();
  });
});
