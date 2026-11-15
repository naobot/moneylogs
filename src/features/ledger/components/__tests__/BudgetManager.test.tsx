import { describe, it, expect, beforeEach, afterEach, vi } from "vite-plus/test";
import { act } from "react";
import { createRoot, Root } from "react-dom/client";
import BudgetManager from "@/features/ledger/components/BudgetManager";
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
        <BudgetManager
          isOpen
          categories={CATEGORIES}
          defaultCurrency="JPY"
          onClose={onClose}
          onSave={onSave}
          isSaving={false}
        />,
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
  const submit = (el: HTMLElement) =>
    act(() => {
      el.closest("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    });

  it("lists an editor per active category, with existing budgets", () => {
    expect(byLabel("Monthly budget for Food")).not.toBeNull();
    expect(byLabel("Monthly budget for Transport")).not.toBeNull();
    expect(byLabel("Monthly budget for Old")).toBeNull();
    expect(document.body.textContent).toContain("80 EUR / month");
    expect(button("Save").disabled).toBe(true);
  });

  it("sets and removes a monthly budget per currency", async () => {
    const input = byLabel("Monthly budget for Food") as HTMLInputElement;
    type(input, "abc");
    expect(byLabel("Set budget for Food").disabled).toBe(true);
    type(input, "30,000");
    act(() => byLabel("Set budget for Food").click());
    expect(document.body.textContent).toContain("30,000 JPY / month");

    act(() => byLabel("Remove JPY budget for Food").click());
    expect(document.body.textContent).not.toContain("30,000 JPY / month");
    type(byLabel("Monthly budget for Food") as HTMLInputElement, "25000");
    submit(byLabel("Monthly budget for Food"));

    await act(async () => button("Save").click());
    expect(onSave).toHaveBeenCalledWith([
      { type: "setBudget", id: "food", currency: "JPY", amount: 30000 },
      { type: "setBudget", id: "food", currency: "JPY", amount: null },
      { type: "setBudget", id: "food", currency: "JPY", amount: 25000 },
    ]);
    expect(onClose).toHaveBeenCalled();
  });

  it("keeps the dialog open with an error when saving fails", async () => {
    onSave.mockRejectedValueOnce(new Error("offline"));
    act(() => byLabel("Remove EUR budget for Transport").click());
    await act(async () => button("Save").click());
    expect(document.body.textContent).toContain("Couldn't save your changes");
    expect(onClose).not.toHaveBeenCalled();
  });
});
