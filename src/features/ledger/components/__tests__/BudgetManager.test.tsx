import { describe, it, expect, beforeEach, afterEach, vi } from "vite-plus/test";
import { act } from "react";
import { createRoot, Root } from "react-dom/client";
import BudgetManager from "@/features/ledger/components/BudgetManager";
import { ToastProvider } from "@/contexts/ToastContext";
import { LedgerCategory } from "@/types/ledger";
import { CategoryOp } from "@/utils/ledgerCategories";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const CATEGORIES: LedgerCategory[] = [
  { id: "food", name: "Food", order: 0 },
  { id: "transport", name: "Transport", order: 1, budget: { EUR: 80 } },
  { id: "old", name: "Old", order: 2, archived: true },
];

describe("BudgetManager", () => {
  let container: HTMLDivElement;
  let root: Root;
  let onSave: ReturnType<typeof vi.fn<(ops: CategoryOp[]) => Promise<unknown>>>;
  let onClose: ReturnType<typeof vi.fn<() => void>>;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    onSave = vi.fn<(ops: CategoryOp[]) => Promise<unknown>>(async () => {});
    onClose = vi.fn<() => void>();
    act(() =>
      root.render(
        <ToastProvider>
          <BudgetManager
            isOpen
            categories={CATEGORIES}
            defaultCurrency="JPY"
            onClose={onClose}
            onSave={onSave}
          />
        </ToastProvider>,
      ),
    );
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    document.body.innerHTML = "";
  });

  // The modal is portalled, so query the whole document.
  const byLabel = (label: string) =>
    document.querySelector(`[aria-label="${label}"]`) as HTMLButtonElement | HTMLInputElement;
  const button = (text: string) =>
    Array.from(document.querySelectorAll("button")).find((b) => b.textContent === text)!;
  const type = (el: HTMLInputElement, value: string) => {
    const descriptor = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!;
    act(() => {
      descriptor.set?.call(el, value);
      el.dispatchEvent(new Event("input", { bubbles: true }));
    });
  };
  const rows = () =>
    Array.from(document.querySelectorAll('[aria-label="Category budgets"] li')).map(
      (li) => li.textContent,
    );
  const open = (name: string) =>
    act(() =>
      Array.from(document.querySelectorAll<HTMLButtonElement>(".CategoryManager__select"))
        .find((b) => b.querySelector(".CategoryManager__nameText")?.textContent === name)!
        .click(),
    );
  const back = () => act(() => byLabel("Back to budgets").click());
  const settle = () => act(async () => {});
  const saved = () => onSave.mock.calls.map(([ops]) => ops);

  it("lists each active category's budget, and saves as you go with just Done", () => {
    expect(rows()).toEqual(["Foodno budget›", "Transport80 EUR/mo›"]);
    expect(button("Save")).toBeUndefined();
    expect(button("Cancel")).toBeUndefined();
    expect(document.body.textContent).toContain("changes save automatically");
    act(() => button("Done").click());
    expect(onClose).toHaveBeenCalled();
    expect(onSave).not.toHaveBeenCalled();
  });

  it("opens just the budget part of a category, and goes back", () => {
    open("Food");
    expect(byLabel("Monthly budget for Food")).not.toBeNull();
    // Pared down: no name, fixed, archive or delete.
    expect(byLabel("Rename Food")).toBeNull();
    expect(byLabel("Food is a fixed cost")).toBeNull();
    expect(byLabel("Delete Food")).toBeNull();
    back();
    expect(rows()).toHaveLength(2);
  });

  it("saves a budget when its field is left", async () => {
    open("Food");
    const field = byLabel("Monthly budget for Food") as HTMLInputElement;
    act(() => field.focus());
    type(field, "30,000");
    await settle();
    expect(onSave).not.toHaveBeenCalled();
    act(() => field.blur());
    await settle();
    expect(saved()).toEqual([[{ type: "setBudget", id: "food", currency: "EUR", amount: 30000 }]]);
    back();
    expect(rows()[0]).toContain("30,000 EUR/mo");
  });

  it("removes a budget with one tap", async () => {
    open("Transport");
    expect((byLabel("Transport budget in EUR") as HTMLInputElement).value).toBe("80");
    act(() => byLabel("Remove Transport budget in EUR").click());
    await settle();
    expect(saved()).toEqual([
      [{ type: "setBudget", id: "transport", currency: "EUR", amount: null }],
    ]);
    back();
    expect(rows()[1]).toContain("no budget");
  });

  it("blocks saving an invalid amount, keeping what was typed", async () => {
    open("Food");
    const field = byLabel("Monthly budget for Food") as HTMLInputElement;
    act(() => field.focus());
    type(field, "abc");
    expect(document.body.textContent).toContain("Enter an amount between 0 and");
    act(() => field.blur());
    await settle();
    expect(onSave).not.toHaveBeenCalled();
    expect(field.value).toBe("abc");
  });

  it("shows an error when saving fails", async () => {
    onSave.mockRejectedValueOnce(new Error("offline"));
    open("Transport");
    act(() => byLabel("Remove Transport budget in EUR").click());
    await settle();
    expect(document.body.textContent).toContain("Couldn't save that change");
    expect(byLabel("Transport budget in EUR")).not.toBeNull();
    expect(onClose).not.toHaveBeenCalled();
  });
});
