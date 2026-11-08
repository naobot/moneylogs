import { describe, it, expect, beforeEach, afterEach, vi } from "vite-plus/test";
import { act } from "react";
import { createRoot, Root } from "react-dom/client";
import EntryForm, { EntryFormValues } from "@/features/ledger/components/EntryForm";
import { LedgerCategory } from "@/types/ledger";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const CATEGORIES: LedgerCategory[] = [
  { id: "food", name: "Food", order: 0 },
  { id: "transport", name: "Transport", order: 1 },
  { id: "old", name: "Old stuff", order: 2, archived: true },
];

const INITIAL: EntryFormValues = {
  amount: "",
  currency: "JPY",
  categoryId: "food",
  date: "2026-11-08",
  note: "",
};

describe("EntryForm", () => {
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

  const render = (props: Partial<Parameters<typeof EntryForm>[0]> = {}) => {
    const onSubmit = vi.fn(async () => {});
    act(() =>
      root.render(
        <EntryForm
          mode="add"
          categories={CATEGORIES}
          initial={INITIAL}
          isSaving={false}
          onSubmit={onSubmit}
          {...props}
        />,
      ),
    );
    return onSubmit;
  };

  const field = (label: string) =>
    Array.from(container.querySelectorAll("label"))
      .find((l) => l.querySelector("span")?.textContent === label)!
      .querySelector("input, select") as HTMLInputElement | HTMLSelectElement;

  const setValue = (el: HTMLInputElement | HTMLSelectElement, value: string) => {
    const proto =
      el instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
    const descriptor = Object.getOwnPropertyDescriptor(proto, "value")!;
    act(() => {
      descriptor.set?.call(el, value);
      el.dispatchEvent(
        new Event(el instanceof HTMLSelectElement ? "change" : "input", { bubbles: true }),
      );
    });
  };

  const addButton = () =>
    Array.from(container.querySelectorAll("button")).find((b) => b.textContent === "Add")!;

  it("keeps Add disabled until the amount parses as a positive number", () => {
    render();
    expect(addButton().disabled).toBe(true);
    setValue(field("Amount"), "abc");
    expect(addButton().disabled).toBe(true);
    setValue(field("Amount"), "1,200");
    expect(addButton().disabled).toBe(false);
  });

  it("only offers active categories when adding", () => {
    render();
    const options = Array.from((field("Category") as HTMLSelectElement).options).map(
      (o) => o.value,
    );
    expect(options).toEqual(["food", "transport"]);
  });

  it("submits a parsed entry, then clears amount and note but keeps the rest", async () => {
    const onSubmit = render();
    setValue(field("Amount"), "1,200");
    setValue(field("Category"), "transport");
    setValue(field("Note"), "  Train  ");
    await act(async () => addButton().click());

    expect(onSubmit).toHaveBeenCalledWith({
      amount: 1200,
      currency: "JPY",
      categoryId: "transport",
      date: "2026-11-08",
      note: "Train",
    });
    expect(field("Amount").value).toBe("");
    expect(field("Note").value).toBe("");
    expect(field("Category").value).toBe("transport");
    expect(field("Date").value).toBe("2026-11-08");
  });

  it("shows an error and keeps the values when saving fails", async () => {
    const onSubmit = vi.fn(async () => {
      throw new Error("permission-denied");
    });
    render({ onSubmit });
    setValue(field("Amount"), "5");
    await act(async () => addButton().click());
    expect(container.textContent).toContain("Couldn't save that entry");
    expect(field("Amount").value).toBe("5");
  });

  it("keeps an entry's archived category selectable when editing it", () => {
    render({ mode: "edit", initial: { ...INITIAL, amount: "5", categoryId: "old" } });
    const select = field("Category") as HTMLSelectElement;
    expect(select.value).toBe("old");
    expect(Array.from(select.options).map((o) => o.textContent)).toContain("Old stuff (archived)");
  });
});
