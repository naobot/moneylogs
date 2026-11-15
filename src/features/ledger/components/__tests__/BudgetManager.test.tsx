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

  const field = (name: string) => byLabel(`Monthly budget for ${name}`) as HTMLInputElement;
  const select = (el: HTMLSelectElement, value: string) =>
    act(() => {
      el.value = value;
      el.dispatchEvent(new Event("change", { bubbles: true }));
    });

  const currencyOf = (name: string) =>
    byLabel(`Budget currency for ${name}`) as unknown as HTMLSelectElement;

  it("shows each active category's amount and its own currency", () => {
    expect(byLabel("Budget currency")).toBeNull(); // no window-wide picker
    // Transport already budgets in EUR; Food has none yet, so the log's default.
    expect(currencyOf("Transport").value).toBe("EUR");
    expect(field("Transport").value).toBe("80");
    expect(currencyOf("Food").value).toBe("JPY");
    expect(field("Food").value).toBe("");
    expect(byLabel("Monthly budget for Old")).toBeNull();
    // No per-field "set" step, only Save.
    expect(document.querySelector('[aria-label^="Set budget"]')).toBeNull();
    expect(button("Save").disabled).toBe(true);
  });

  it("saves typed, changed and cleared amounts across currencies in one go", async () => {
    type(field("Food"), "30,000");
    select(currencyOf("Food"), "EUR");
    expect(field("Food").value).toBe("");
    type(field("Food"), "250");
    expect(currencyOf("Transport").value).toBe("EUR"); // other rows unaffected
    select(currencyOf("Food"), "JPY");
    expect(field("Food").value).toBe("30,000"); // kept across the switch
    type(field("Transport"), "");

    await act(async () => button("Save").click());
    expect(onSave).toHaveBeenCalledWith([
      { type: "setBudget", id: "food", currency: "JPY", amount: 30000 },
      { type: "setBudget", id: "food", currency: "EUR", amount: 250 },
      { type: "setBudget", id: "transport", currency: "EUR", amount: null },
    ]);
    expect(onClose).toHaveBeenCalled();
  });

  it("blocks Save while an amount is invalid", () => {
    type(field("Food"), "abc");
    expect(document.body.textContent).toContain("Enter an amount between 0 and");
    expect(button("Save").disabled).toBe(true);
    type(field("Food"), "50");
    expect(button("Save").disabled).toBe(false);
  });

  it("keeps the dialog open with an error when saving fails", async () => {
    onSave.mockRejectedValueOnce(new Error("offline"));
    type(field("Transport"), "90");
    await act(async () => button("Save").click());
    expect(document.body.textContent).toContain("Couldn't save your changes");
    expect(onClose).not.toHaveBeenCalled();
  });
});
