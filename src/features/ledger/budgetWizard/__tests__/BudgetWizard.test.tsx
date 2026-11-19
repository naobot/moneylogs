import { describe, it, expect, beforeEach, afterEach, vi } from "vite-plus/test";
import { act } from "react";
import { createRoot, Root } from "react-dom/client";
import { AcceptedPlan, BudgetWizard } from "@/features/ledger/budgetWizard/BudgetWizard";
import BudgetManager from "@/features/ledger/components/BudgetManager";
import { ToastProvider } from "@/contexts/ToastContext";
import { DEFAULT_CATEGORIES } from "@/utils/ledger";
import { CategoryOp } from "@/utils/ledgerCategories";
import { LedgerCategory } from "@/types/ledger";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const defaults = (): LedgerCategory[] => DEFAULT_CATEGORIES.map((c) => ({ ...c }));
// Defaults, but with a custom category and Food renamed.
const customised = (): LedgerCategory[] => [
  ...defaults().map((c) => (c.id === "food" ? { ...c, name: "Eating out" } : c)),
  { id: "coffee", name: "Coffee", order: 10 },
];

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
  document.body.innerHTML = "";
});

// Modals are portalled, so query the whole document.
const byLabel = <T extends HTMLElement = HTMLInputElement>(label: string) =>
  document.querySelector(`[aria-label="${label}"]`) as T;
const button = (text: string) =>
  Array.from(document.querySelectorAll("button")).find(
    (b) => b.textContent?.trim().toLowerCase() === text.toLowerCase(),
  ) as HTMLButtonElement;
const type = (el: HTMLInputElement, value: string) => {
  const descriptor = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!;
  act(() => {
    descriptor.set?.call(el, value);
    el.dispatchEvent(new Event("input", { bubbles: true }));
  });
};
const click = (el: HTMLElement) => act(() => el.click());
const planAmounts = () =>
  Array.from(document.querySelectorAll<HTMLInputElement>(".BudgetWizard__planAmount input")).map(
    (el) => el.value,
  );
const savingsText = () =>
  document.querySelector(".BudgetWizard__planRow--savings")!.textContent ?? "";

/** Start → income → housing → saving → plan. */
const walkToPlan = () => {
  click(button("Start"));
  expect(button("Next").disabled).toBe(true);
  type(byLabel("Monthly income"), "400,000");
  click(button("Next"));
  type(byLabel("Rent or mortgage"), "100000");
  type(byLabel("Utilities"), "15000");
  click(button("Next"));
  expect(button("Next").disabled).toBe(true);
  click(button("I want to save steadily and still enjoy myself"));
  click(button("Next"));
};

describe("BudgetWizard", () => {
  const render = (categories: LedgerCategory[], onUse = vi.fn<(p: AcceptedPlan) => void>()) => {
    act(() =>
      root.render(
        <BudgetWizard
          categories={categories}
          defaultCurrency="JPY"
          onCancel={() => {}}
          onUse={onUse}
          initialSeed={1}
        />,
      ),
    );
    return onUse;
  };

  it("warns up front exactly how the categories will be reset", () => {
    render(customised());
    const warning = document.querySelector(".BudgetWizard__warning")!.textContent;
    expect(warning).toContain("Archive Coffee");
    expect(warning).toContain("Rename Eating out → Food");
    expect(warning).not.toContain("Add back");
  });

  it("says nothing changes when the categories are already the defaults", () => {
    render(defaults());
    expect(document.querySelector(".BudgetWizard__warning")!.textContent).toContain(
      "nothing about them will change",
    );
  });

  it("suggests a plan with percentages and amounts, and re-rolls it", () => {
    render(defaults());
    walkToPlan();
    const rows = document.querySelectorAll(".BudgetWizard__planRow");
    expect(rows).toHaveLength(DEFAULT_CATEGORIES.length + 1); // + savings
    expect(rows[3].textContent).toContain("Housing");
    expect(rows[3].textContent).toContain("25.0%");
    expect(byLabel("Housing budget").value).toBe("100000");
    expect(savingsText()).toContain("Left to save");

    // The pie: a slice per category (plus savings), each named in its tooltip, and a key.
    const chart = document.querySelector('svg[role="img"]')!;
    expect(chart.getAttribute("aria-label")).toMatch(/^Income split: Housing & utilities 28\.8%/);
    const titles = Array.from(chart.querySelectorAll("title")).map((t) => t.textContent);
    expect(titles).toContain("Housing: 25.0% · 100,000 JPY");
    expect(titles.some((t) => t?.startsWith("Left to save:"))).toBe(true);
    expect(document.querySelector('[aria-label="Chart key"]')!.textContent).toContain("Lifestyle");
    expect(document.body.textContent).toContain("suggestion you can change");

    const before = planAmounts();
    click(button("re-roll"));
    expect(planAmounts()).not.toEqual(before);
    expect(planAmounts()[3]).toBe("100000"); // fixed costs don't move
  });

  it("lets amounts be edited in place, keeping them within the income", () => {
    const onUse = render(defaults());
    walkToPlan();
    // Free up Travel entirely: savings grow by what it had.
    const travel = Number(byLabel("Travel budget").value);
    const savingsBefore = Number(
      savingsText()
        .match(/([\d,]+) JPY/)![1]
        .replace(/,/g, ""),
    );
    type(byLabel("Travel budget"), "");
    expect(savingsText()).toContain(`${(savingsBefore + travel).toLocaleString("en-US")} JPY`);

    // Housing 25% → 50%, and the % follows.
    type(byLabel("Housing budget"), "200,000");
    expect(document.querySelectorAll(".BudgetWizard__planRow")[3].textContent).toContain("50.0%");

    // Past the income: explained, and the plan can't be used.
    type(byLabel("Housing budget"), "900000");
    expect(document.body.textContent).toContain("more than your income of 400,000 JPY");
    expect(button("Use this plan").disabled).toBe(true);

    // Not a number: explained, and blocked.
    type(byLabel("Housing budget"), "abc");
    expect(document.body.textContent).toContain("Enter each amount as a number");
    expect(button("Use this plan").disabled).toBe(true);

    type(byLabel("Housing budget"), "120000");
    click(button("Use this plan"));
    expect(onUse.mock.calls[0][0].amounts).toMatchObject({ housing: 120_000, travel: 0 });
  });

  it("re-rolling replaces the user's edits", () => {
    render(defaults());
    walkToPlan();
    type(byLabel("Housing budget"), "123");
    click(button("re-roll"));
    expect(byLabel("Housing budget").value).toBe("100000");
  });

  it("explains when housing and utilities leave nothing to plan with", () => {
    render(defaults());
    click(button("Start"));
    type(byLabel("Monthly income"), "1000");
    click(button("Next"));
    type(byLabel("Rent or mortgage"), "1000");
    click(button("Next"));
    click(button("I want to live frugally and save a lot"));
    click(button("Next"));
    expect(document.body.textContent).toContain("take up all of that income");
    expect(button("Use this plan").disabled).toBe(true);
  });

  it("hands over the reset ops, currency and amounts by actual category id", () => {
    const onUse = render(customised());
    walkToPlan();
    click(button("Use this plan"));
    const accepted = onUse.mock.calls[0][0];
    expect(accepted.currency).toBe("JPY");
    expect(accepted.resetOps).toContainEqual({ type: "archive", id: "coffee" });
    expect(accepted.amounts.housing).toBe(100_000);
    expect(Object.keys(accepted.amounts)).toHaveLength(DEFAULT_CATEGORIES.length);
  });
});

describe("Budgets window with the budget helper", () => {
  const renderBudgets = (
    categories: LedgerCategory[],
    onSave: (ops: CategoryOp[]) => Promise<unknown> = async () => {},
  ) =>
    act(() =>
      root.render(
        <ToastProvider>
          <BudgetManager
            isOpen
            categories={categories}
            defaultCurrency="JPY"
            onClose={() => {}}
            onSave={onSave}
          />
        </ToastProvider>,
      ),
    );

  it("warns about the category reset on the plan step, then saves it with the budgets in one write", async () => {
    const onSave = vi.fn<(ops: CategoryOp[]) => Promise<unknown>>(async () => {});
    renderBudgets(customised(), onSave);
    click(button("Need help setting a budget?"));
    walkToPlan();
    // Using the plan saves straight away, so the reset is spelled out right there.
    expect(document.body.textContent).toContain("Using it will reset your categories");
    expect(document.body.textContent).toContain("Archive Coffee");
    click(button("Use this plan"));
    await act(async () => {});

    expect(onSave).toHaveBeenCalledTimes(1);
    const ops = onSave.mock.calls[0][0];
    const firstBudget = ops.findIndex((op) => op.type === "setBudget");
    // Category reset first, then budgets.
    expect(ops.slice(0, firstBudget)).toContainEqual({ type: "archive", id: "coffee" });
    expect(ops.slice(firstBudget).every((op) => op.type === "setBudget")).toBe(true);
    expect(ops).toContainEqual({
      type: "setBudget",
      id: "housing",
      currency: "JPY",
      amount: 100_000,
    });

    // Back in the Budgets window, saying so, with the budgets shown.
    expect(document.body.textContent).toContain("The helper's plan is saved");
    expect(document.body.textContent).toContain("100,000 JPY/mo");
    expect(document.body.textContent).not.toContain("Coffee"); // archived
  });

  it("goes back to the budgets untouched from the helper's first step", async () => {
    const onSave = vi.fn<(ops: CategoryOp[]) => Promise<unknown>>(async () => {});
    renderBudgets(defaults(), onSave);
    click(button("Need help setting a budget?"));
    click(button("Back to budgets"));
    await act(async () => {});
    expect(document.querySelector('[aria-label="Category budgets"]')).not.toBeNull();
    expect(onSave).not.toHaveBeenCalled();
  });
});
