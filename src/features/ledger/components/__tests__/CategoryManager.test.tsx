import { describe, it, expect, beforeEach, afterEach, vi } from "vite-plus/test";
import { act } from "react";
import { createRoot, Root } from "react-dom/client";
import CategoryManager from "@/features/ledger/components/CategoryManager";
import { ToastProvider } from "@/contexts/ToastContext";
import { LedgerCategory } from "@/types/ledger";
import { CategoryOp } from "@/utils/ledgerCategories";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const CATEGORIES: LedgerCategory[] = [
  { id: "food", name: "Food", order: 0, budget: { JPY: 30000 } },
  { id: "transport", name: "Transport", order: 1 },
  { id: "old", name: "Old", order: 2, archived: true },
];

describe("CategoryManager", () => {
  let container: HTMLDivElement;
  let root: Root;
  let onSave: ReturnType<typeof vi.fn<(ops: CategoryOp[]) => Promise<unknown>>>;
  let checkInUse: ReturnType<typeof vi.fn<(categoryId: string) => Promise<boolean>>>;
  let onClose: ReturnType<typeof vi.fn<() => void>>;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    onSave = vi.fn<(ops: CategoryOp[]) => Promise<unknown>>(async () => {});
    checkInUse = vi.fn<(categoryId: string) => Promise<boolean>>(async () => false);
    onClose = vi.fn<() => void>();
    act(() =>
      root.render(
        <ToastProvider>
          <CategoryManager
            isOpen
            categories={CATEGORIES}
            defaultCurrency="JPY"
            onClose={onClose}
            onSave={onSave}
            checkInUse={checkInUse}
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
  const names = (list: string) =>
    Array.from(document.querySelectorAll(`[aria-label="${list}"] .CategoryManager__nameText`)).map(
      (el) => el.textContent,
    );
  const activeNames = () => names("Active categories");
  /** Taps a category's row (narrow layout: opens its detail). */
  const open = (name: string) =>
    act(() =>
      Array.from(document.querySelectorAll<HTMLButtonElement>(".CategoryManager__select"))
        .find((b) => b.querySelector(".CategoryManager__nameText")?.textContent === name)!
        .click(),
    );
  const back = () => act(() => byLabel("Back to categories").click());
  /** Archives via the detail's button and its confirmation. */
  const archive = (name: string) => {
    act(() => byLabel(`Archive ${name}`).click());
    expect(document.body.textContent).toContain("Past entries keep it");
    act(() => button("Archive").click());
  };
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
  // Lets queued saves run.
  const settle = () => act(async () => {});
  const saved = () => onSave.mock.calls.map(([ops]) => ops);

  it("only offers the sublog line when given a handler", () => {
    expect(document.body.textContent).not.toContain("make it a sublog");
  });

  it("closes the window, then opens the sublog intro, from the sublog line", () => {
    const onSublogHelp = vi.fn();
    act(() =>
      root.render(
        <ToastProvider>
          <CategoryManager
            isOpen
            categories={CATEGORIES}
            defaultCurrency="JPY"
            onClose={onClose}
            onSave={onSave}
            checkInUse={checkInUse}
            onSublogHelp={onSublogHelp}
          />
        </ToastProvider>,
      ),
    );
    act(() => button("make it a sublog").click());
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onSublogHelp).toHaveBeenCalledTimes(1);
  });

  it("has no Save or Cancel, just Done", () => {
    expect(activeNames()).toEqual(["Food", "Transport"]);
    expect(button("Save")).toBeUndefined();
    expect(button("Cancel")).toBeUndefined();
    act(() => button("Done").click());
    expect(onClose).toHaveBeenCalled();
    expect(onSave).not.toHaveBeenCalled();
  });

  it("shows fixed and budget status on each row, without opening it", () => {
    const row = document.querySelector('[aria-label="Active categories"] li')!;
    expect(row.textContent).toContain("30,000 JPY/mo");
    expect(names("Archived categories")).toEqual(["Old"]);
  });

  it("on narrow screens, opens a category's detail from its row and goes back", () => {
    expect(byLabel("Rename Food")).toBeNull();
    open("Food");
    expect(byLabel("Rename Food")).not.toBeNull();
    expect(byLabel("Active categories")).toBeNull();
    // Explanations are written out, not hidden in hover tips.
    expect(document.body.textContent).toContain("the buddy won't fuss over them");
    expect(document.querySelector('[role="tooltip"]')).toBeNull();
    back();
    expect(activeNames()).toEqual(["Food", "Transport"]);
  });

  it("saves each add and rename as it's made, and opens a new category", async () => {
    type(byLabel("New category name") as HTMLInputElement, "Coffee");
    submit(byLabel("New category name"));
    // The new category opens, so its settings are right there.
    expect((byLabel("Rename Coffee") as HTMLInputElement).value).toBe("Coffee");
    back();
    expect(activeNames()).toEqual(["Food", "Transport", "Coffee"]);

    open("Food");
    const rename = byLabel("Rename Food") as HTMLInputElement;
    type(rename, "Eating out");
    submit(rename);
    back();
    // Shown straight away, before the writes finish.
    expect(activeNames()).toEqual(["Eating out", "Transport", "Coffee"]);

    await settle();
    expect(saved()).toEqual([
      [{ type: "add", id: "coffee", name: "Coffee", fixed: false }],
      [{ type: "rename", id: "food", name: "Eating out" }],
    ]);
    expect(onClose).not.toHaveBeenCalled();
  });

  it("guesses fixed from a new category's name", async () => {
    type(byLabel("New category name") as HTMLInputElement, "Rent");
    submit(byLabel("New category name"));
    expect((byLabel("Rent is a fixed cost") as HTMLInputElement).checked).toBe(true);
    await settle();
    expect(saved()).toEqual([[{ type: "add", id: "rent", name: "Rent", fixed: true }]]);
  });

  it("writes edits in order, one after another", async () => {
    let finishFirst!: () => void;
    onSave.mockImplementationOnce(() => new Promise<void>((resolve) => (finishFirst = resolve)));
    open("Transport");
    archive("Transport");
    back();
    open("Food");
    act(() => (byLabel("Food is a fixed cost") as HTMLInputElement).click());
    expect((byLabel("Food is a fixed cost") as HTMLInputElement).checked).toBe(true);
    await settle();
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(document.body.textContent).toContain("saving...");

    await act(async () => finishFirst());
    expect(saved()).toEqual([
      [{ type: "archive", id: "transport" }],
      [{ type: "setFixed", id: "food", fixed: true }],
    ]);
    expect(document.body.textContent).not.toContain("saving...");
  });

  it("explains and blocks duplicate names", () => {
    type(byLabel("New category name") as HTMLInputElement, "food");
    expect(document.body.textContent).toContain('"Food" already exists');
    expect(button("Add").disabled).toBe(true);
  });

  it("archives (after confirming) and restores, but never the last active category", async () => {
    open("Transport");
    act(() => byLabel("Archive Transport").click());
    // Back changes nothing.
    act(() => button("Back").click());
    expect(onSave).not.toHaveBeenCalled();
    archive("Transport");
    // Still open, now as an archived category.
    expect(byLabel("Restore Transport")).not.toBeNull();
    back();
    expect(activeNames()).toEqual(["Food"]);

    open("Food");
    expect(byLabel("Archive Food").disabled).toBe(true);
    expect(byLabel("Delete Food").disabled).toBe(true);
    expect(document.body.textContent).toContain("has to stay");
    back();

    open("Old");
    act(() => byLabel("Restore Old").click());
    back();
    expect(activeNames()).toEqual(["Food", "Old"]);

    await settle();
    expect(saved()).toEqual([
      [{ type: "archive", id: "transport" }],
      [{ type: "unarchive", id: "old" }],
    ]);
  });

  it("deletes an unused active category after confirming", async () => {
    open("Transport");
    await act(async () => byLabel("Delete Transport").click());
    expect(checkInUse).toHaveBeenCalledWith("transport");
    expect(document.body.textContent).toContain("can't be undone");
    expect(onSave).not.toHaveBeenCalled();

    act(() => button("Back").click());
    await act(async () => byLabel("Delete Transport").click());
    act(() => button("Delete").click());
    // Back to the list, without it.
    expect(activeNames()).toEqual(["Food"]);

    await settle();
    expect(saved()).toEqual([[{ type: "delete", id: "transport" }]]);
  });

  it("offers archiving instead when entries use the category", async () => {
    checkInUse.mockResolvedValueOnce(true);
    open("Transport");
    await act(async () => byLabel("Delete Transport").click());
    expect(document.body.textContent).toContain("Some entries use Transport");
    expect(button("Delete")).toBeUndefined();

    act(() => button("Archive instead").click());
    await settle();
    expect(saved()).toEqual([[{ type: "archive", id: "transport" }]]);
  });

  it("explains when it couldn't check whether a category is in use", async () => {
    checkInUse.mockRejectedValueOnce(new Error("offline"));
    open("Old");
    await act(async () => byLabel("Delete Old").click());
    expect(document.body.textContent).toContain("Couldn't check whether this category is in use");
    expect(onSave).not.toHaveBeenCalled();
    await act(async () => button("Try again").click());
    expect(document.body.textContent).toContain("Delete Old?");
  });

  it("reorders by drag handle only: every active row has one, no up/down buttons", () => {
    expect(byLabel("Reorder Food")).not.toBeNull();
    expect(byLabel("Reorder Transport")).not.toBeNull();
    expect(byLabel("Move Food up")).toBeNull();
  });

  it("removes a budget with one tap", async () => {
    open("Food");
    expect((byLabel("Food budget in JPY") as HTMLInputElement).value).toBe("30000");
    act(() => byLabel("Remove Food budget in JPY").click());
    expect(byLabel("Food budget in JPY")).toBeNull();
    expect(document.body.textContent).toContain("no budget");
    await settle();
    expect(saved()).toEqual([[{ type: "setBudget", id: "food", currency: "JPY", amount: null }]]);
  });

  it("saves a budget when its field is left, with no separate set step", async () => {
    open("Transport");
    const field = byLabel("Monthly budget for Transport") as HTMLInputElement;
    act(() => field.focus());
    type(field, "5,000");
    await settle();
    expect(onSave).not.toHaveBeenCalled();

    act(() => field.blur());
    await settle();
    expect(saved()).toEqual([
      [{ type: "setBudget", id: "transport", currency: "JPY", amount: 5000 }],
    ]);
    // Now listed as a budget of its own, with a way to remove it.
    expect(byLabel("Remove Transport budget in JPY")).not.toBeNull();
    back();
    expect(document.body.textContent).toContain("5,000 JPY/mo");
  });

  it("adds a budget in a second currency, keeping the first", async () => {
    open("Food");
    // Tucked away until asked for.
    expect(byLabel("Budget currency for Food")).toBeNull();
    act(() => button("[+ mixed currency budget]").click());
    const picker = byLabel("Budget currency for Food") as unknown as HTMLSelectElement;
    // JPY already has a budget, so it isn't offered again.
    expect(Array.from(picker.options).map((o) => o.value)).not.toContain("JPY");
    act(() => {
      picker.value = "CAD";
      picker.dispatchEvent(new Event("change", { bubbles: true }));
    });
    const field = byLabel("Monthly budget for Food in another currency") as HTMLInputElement;
    act(() => field.focus());
    type(field, "200");
    act(() => field.blur());
    await settle();
    expect(saved()).toEqual([[{ type: "setBudget", id: "food", currency: "CAD", amount: 200 }]]);
    expect(byLabel("Food budget in JPY")).not.toBeNull();
    expect(byLabel("Food budget in CAD")).not.toBeNull();
  });

  it("saves a budget still being typed when Done is pressed", async () => {
    open("Transport");
    type(byLabel("Monthly budget for Transport") as HTMLInputElement, "500");
    act(() => button("Done").click());
    await settle();
    expect(saved()).toEqual([
      [{ type: "setBudget", id: "transport", currency: "JPY", amount: 500 }],
    ]);
    expect(onClose).toHaveBeenCalled();
  });

  it("undoes an edit that fails to save, with an error", async () => {
    onSave.mockRejectedValueOnce(new Error("offline"));
    open("Transport");
    archive("Transport");
    await settle();
    expect(document.body.textContent).toContain("Couldn't save that change");
    back();
    expect(activeNames()).toEqual(["Food", "Transport"]);
    expect(onClose).not.toHaveBeenCalled();
  });
});

describe("CategoryManager on wide screens", () => {
  const original = window.matchMedia;
  let root: Root;

  beforeEach(() => {
    window.matchMedia = vi.fn(
      (query: string) =>
        ({
          matches: query.includes("min-width"),
          addEventListener: () => {},
          removeEventListener: () => {},
        }) as unknown as MediaQueryList,
    );
    const container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    act(() =>
      root.render(
        <ToastProvider>
          <CategoryManager
            isOpen
            categories={CATEGORIES}
            defaultCurrency="JPY"
            onClose={() => {}}
            onSave={async () => {}}
            checkInUse={async () => false}
          />
        </ToastProvider>,
      ),
    );
  });

  afterEach(() => {
    act(() => root.unmount());
    window.matchMedia = original;
    document.body.innerHTML = "";
  });

  const selectedName = () =>
    document.querySelector('[aria-current="true"] .CategoryManager__nameText')?.textContent;

  it("shows the list and the first category's detail side by side", () => {
    expect(document.querySelector('[aria-label="Active categories"]')).not.toBeNull();
    expect(document.querySelector('[aria-label="Rename Food"]')).not.toBeNull();
    expect(document.querySelector('[aria-label="Back to categories"]')).toBeNull();
    expect(selectedName()).toBe("Food");
  });

  it("switches the detail to the tapped row", () => {
    act(() =>
      Array.from(document.querySelectorAll<HTMLButtonElement>(".CategoryManager__select"))
        .find((b) => b.textContent?.includes("Transport"))!
        .click(),
    );
    expect(document.querySelector('[aria-label="Rename Transport"]')).not.toBeNull();
    expect(selectedName()).toBe("Transport");
  });
});
