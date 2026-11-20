import { describe, it, expect, beforeEach, afterEach, vi } from "vite-plus/test";
import { act } from "react";
import { createRoot, Root } from "react-dom/client";
import MonthlyTotalModal from "@/features/ledger/components/MonthlyTotalModal";
import { CurrencyAmounts, LedgerCategory } from "@/types/ledger";
import { TotalOp } from "@/utils/monthlyBudget";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const CATEGORIES: LedgerCategory[] = [
  { id: "food", name: "Food", order: 0, budget: { CAD: 400 } },
  { id: "rent", name: "Rent", order: 1, budget: { CAD: 1500 } },
];

describe("MonthlyTotalModal", () => {
  let container: HTMLDivElement;
  let root: Root;
  let onSave: ReturnType<typeof vi.fn<(ops: TotalOp[]) => Promise<unknown>>>;
  let onClose: ReturnType<typeof vi.fn<() => void>>;
  let onEditCategories: ReturnType<typeof vi.fn<() => void>>;

  const render = (totals?: CurrencyAmounts) =>
    act(() =>
      root.render(
        <MonthlyTotalModal
          isOpen
          currency="CAD"
          totals={totals}
          categories={CATEGORIES}
          onClose={onClose}
          onSave={onSave}
          onEditCategories={onEditCategories}
        />,
      ),
    );

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    onSave = vi.fn<(ops: TotalOp[]) => Promise<unknown>>(async () => {});
    onClose = vi.fn<() => void>();
    onEditCategories = vi.fn<() => void>();
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    document.body.innerHTML = "";
  });

  const field = () => document.querySelector('[aria-label="Monthly total"]') as HTMLInputElement;
  const button = (text: string) =>
    Array.from(document.querySelectorAll("button")).find((b) => b.textContent === text)!;
  const type = (el: HTMLInputElement, value: string) => {
    const descriptor = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!;
    act(() => {
      descriptor.set?.call(el, value);
      el.dispatchEvent(new Event("input", { bubbles: true }));
    });
  };
  const status = () => document.querySelector('[role="status"]')?.textContent ?? "";

  it("sets a total and shows what the category budgets leave over", async () => {
    render();
    expect(field().value).toBe("");
    expect(status()).toContain("what your category budgets add up to");
    type(field(), "3,000");
    expect(status()).toContain("leaving");
    expect(status()).toContain("1,100");
    await act(async () => button("Save").click());
    expect(onSave).toHaveBeenCalledWith([{ currency: "CAD", amount: 3000 }]);
    expect(onClose).toHaveBeenCalled();
  });

  it("warns when the category budgets go past the total", () => {
    render({ CAD: 1500 });
    expect(field().value).toBe("1500");
    expect(status()).toContain("more than this");
  });

  it("removes a total", async () => {
    render({ CAD: 3000 });
    act(() => button("remove total").click());
    expect(field().value).toBe("");
    await act(async () => button("Save").click());
    expect(onSave).toHaveBeenCalledWith([{ currency: "CAD", amount: null }]);
  });

  it("switches currency to that currency's total", () => {
    render({ CAD: 3000, JPY: 200000 });
    const select = document.querySelector(
      '[aria-label="Monthly total currency"]',
    ) as HTMLSelectElement;
    act(() => {
      select.value = "JPY";
      select.dispatchEvent(new Event("change", { bubbles: true }));
    });
    expect(field().value).toBe("200000");
  });

  it("closes without saving when nothing changed, and blocks invalid amounts", async () => {
    render({ CAD: 3000 });
    await act(async () => button("Save").click());
    expect(onSave).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
    type(field(), "abc");
    expect(button("Save").disabled).toBe(true);
  });

  it("keeps the modal open with a message when saving fails", async () => {
    onSave.mockRejectedValueOnce(new Error("denied"));
    render();
    type(field(), "100");
    await act(async () => button("Save").click());
    expect(onClose).not.toHaveBeenCalled();
    expect(document.body.textContent).toContain("Couldn't save the total");
  });

  it("leads to the category budgets", () => {
    render();
    act(() => button("category budgets").click());
    expect(onClose).toHaveBeenCalled();
    expect(onEditCategories).toHaveBeenCalled();
  });
});
