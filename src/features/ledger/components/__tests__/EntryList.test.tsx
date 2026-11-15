import { describe, it, expect, beforeEach, afterEach, vi } from "vite-plus/test";
import { act } from "react";
import { createRoot, Root } from "react-dom/client";
import EntryList from "@/features/ledger/components/EntryList";
import { LedgerCategory, LedgerEntry } from "@/types/ledger";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const CATEGORIES: LedgerCategory[] = [{ id: "food", name: "Food", order: 0 }];
const ENTRIES = [
  {
    id: "e1",
    amount: 1200,
    currency: "JPY",
    categoryId: "food",
    date: "2026-11-03",
    month: "2026-11",
    note: "lunch",
    authorUid: "u1",
    authorName: "Me",
  },
] as unknown as LedgerEntry[];

describe("EntryList editing", () => {
  let container: HTMLDivElement;
  let root: Root;
  let scrollIntoView: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    scrollIntoView = vi.fn();
    Element.prototype.scrollIntoView = scrollIntoView as unknown as Element["scrollIntoView"];
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    act(() =>
      root.render(
        <EntryList
          entries={ENTRIES}
          categories={CATEGORIES}
          currentUid="u1"
          showAuthors={false}
          isSavingEdit={false}
          isDeleting={false}
          onEdit={async () => {}}
          onDelete={async () => {}}
        />,
      ),
    );
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  const scrim = () => container.querySelector(".EntryList__scrim") as HTMLElement | null;
  const startEditing = () =>
    act(() => (container.querySelector(".EntryList__menu .handler") as HTMLElement).click());

  it("dims the screen and scrolls the entry to the top while editing", () => {
    expect(scrim()).toBeNull();
    startEditing();
    const row = container.querySelector(".EntryList__row--editing");
    expect(row).not.toBeNull();
    expect(scrim()).not.toBeNull();
    expect(scrollIntoView).toHaveBeenCalledTimes(1);
    expect(scrollIntoView.mock.contexts[0]).toBe(row);
    expect(scrollIntoView.mock.calls[0][0]).toMatchObject({ block: "start" });
  });

  it("cancels the edit when the dimmed area is clicked", () => {
    startEditing();
    act(() => scrim()!.click());
    expect(container.querySelector(".EntryList__row--editing")).toBeNull();
    expect(scrim()).toBeNull();
  });
});
