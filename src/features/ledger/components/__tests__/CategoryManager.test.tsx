import { describe, it, expect, beforeEach, afterEach, vi } from "vite-plus/test";
import { act } from "react";
import { createRoot, Root } from "react-dom/client";
import CategoryManager from "@/features/ledger/components/CategoryManager";
import { LedgerCategory } from "@/types/ledger";
import { CategoryOp } from "@/utils/ledgerCategories";

vi.mock("@/hooks/useDragReorderEnabled", () => ({ default: () => false }));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const CATEGORIES: LedgerCategory[] = [
  { id: "food", name: "Food", order: 0 },
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
        <CategoryManager
          isOpen
          categories={CATEGORIES}
          onClose={onClose}
          onSave={onSave}
          isSaving={false}
          checkInUse={checkInUse}
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
  const activeNames = () =>
    Array.from(
      document.querySelectorAll('[aria-label="Active categories"] .CategoryManager__name'),
    ).map((el) => (el as HTMLElement).textContent ?? (el as HTMLInputElement).value);
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

  it("starts with nothing to save", () => {
    expect(activeNames()).toEqual(["Food", "Transport"]);
    expect(button("Save").disabled).toBe(true);
  });

  it("adds, renames and reorders, then saves exactly those edits", async () => {
    type(byLabel("New category name") as HTMLInputElement, "Coffee");
    submit(byLabel("New category name"));
    expect(activeNames()).toEqual(["Food", "Transport", "Coffee"]);

    act(() => button("Food").click());
    const rename = byLabel("Rename Food") as HTMLInputElement;
    type(rename, "Eating out");
    submit(rename);
    expect(activeNames()).toEqual(["Eating out", "Transport", "Coffee"]);

    act(() => byLabel("Move Coffee up").click());
    expect(activeNames()).toEqual(["Eating out", "Coffee", "Transport"]);

    await act(async () => button("Save").click());
    expect(onSave).toHaveBeenCalledWith([
      { type: "add", id: "coffee", name: "Coffee" },
      { type: "rename", id: "food", name: "Eating out" },
      { type: "move", id: "coffee", toIndex: 1 },
    ]);
    expect(onClose).toHaveBeenCalled();
  });

  it("explains and blocks duplicate names", () => {
    type(byLabel("New category name") as HTMLInputElement, "food");
    expect(document.body.textContent).toContain('"Food" already exists');
    expect(button("Add").disabled).toBe(true);
  });

  it("archives, restores, and only deletes unused archived categories", async () => {
    act(() => byLabel("Archive Transport").click());
    expect(activeNames()).toEqual(["Food"]);
    // The last active category can't be archived.
    expect(byLabel("Archive Food").disabled).toBe(true);

    checkInUse.mockResolvedValueOnce(true);
    await act(async () => byLabel("Delete Old").click());
    expect(checkInUse).toHaveBeenCalledWith("old");
    expect(document.body.textContent).toContain("can only be archived");
    expect(byLabel("Restore Old")).not.toBeNull();

    await act(async () => byLabel("Delete Transport").click());
    expect(byLabel("Restore Transport")).toBeNull();

    act(() => byLabel("Restore Old").click());
    expect(activeNames()).toEqual(["Food", "Old"]);
  });

  it("keeps the dialog open with an error when saving fails", async () => {
    onSave.mockRejectedValueOnce(new Error("offline"));
    act(() => byLabel("Move Transport up").click());
    await act(async () => button("Save").click());
    expect(document.body.textContent).toContain("Couldn't save your changes");
    expect(onClose).not.toHaveBeenCalled();
  });
});
