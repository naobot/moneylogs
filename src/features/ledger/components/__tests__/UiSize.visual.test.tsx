import { describe, it, expect, vi } from "vite-plus/test";
import { act } from "react";
import { MemoryRouter } from "react-router-dom";

// These ledger components import the Firebase config, which starts Firebase on import
// and fails without the app's env keys (as in CI). Nothing here talks to a backend.
vi.mock("@/config/firebase-config", () => ({
  auth: {},
  db: {},
  storage: {},
  functions: {},
  analytics: null,
}));
// The sidebar looks up the viewer's logs to link sublogs; no backend in a visual test.
vi.mock("@/hooks/useGetMyLedgers", () => ({ useGetMyLedgers: () => ({ ledgers: [] }) }));

import Button from "@/components/Button";
import RowButton from "@/components/RowButton";
import EntryForm from "../EntryForm";
import EntryList from "../EntryList";
import LedgerSidebar from "../LedgerSidebar";
import { LedgerCategory, LedgerEntry } from "@/types/ledger";
import { useVisualHarness } from "@/test/visual";
import "../Ledger.scss";

const CATEGORIES: LedgerCategory[] = [
  { id: "food", name: "food", order: 0 },
  { id: "transport", name: "transport", order: 1 },
  { id: "home", name: "home", order: 2 },
];

const entry = (id: string, categoryId: string, amount: number, note: string, date: string) => ({
  id,
  amount,
  currency: "JPY",
  categoryId,
  date,
  month: "2026-11",
  note,
  authorUid: "u1",
  authorName: "Momo",
});

const ENTRIES = [
  entry("e1", "food", 1280, "lunch set", "2026-11-25"),
  entry("e2", "transport", 2000, "suica top-up", "2026-11-25"),
  entry("e3", "home", 740, "dish soap, sponges", "2026-11-24"),
  entry("e4", "food", 3000, "weekly shop", "2026-11-24"),
] as unknown as LedgerEntry[];

const noop = async () => {};

// The ledger's everyday parts at every Display → Text size × UI size (see v.sizes).
// Text M · UI M must match the snapshots from before either setting existed.
describe("ledger parts at each size (visual)", () => {
  const v = useVisualHarness();

  it("renders the ledger's parts at every text and UI size", async () => {
    v.render(
      <MemoryRouter>
        <div className="Ledger" style={{ display: "flex", flexDirection: "column", gap: "0.75em" }}>
          <LedgerSidebar
            ledgerId="personal"
            categories={CATEGORIES}
            view="entries"
            period={{ kind: "month", key: "2026-11" }}
            currentMonth="2026-11"
            onAddSublog={() => {}}
          />
          <EntryForm
            mode="add"
            categories={CATEGORIES}
            isSaving={false}
            initial={{
              amount: "",
              currency: "JPY",
              categoryId: "food",
              date: "2026-11-25",
              note: "",
            }}
            onSubmit={noop}
            onEditCategories={() => {}}
          />
          <EntryList
            entries={ENTRIES}
            categories={CATEGORIES}
            currentUid="u1"
            showAuthors={false}
            isSavingEdit={false}
            isDeleting={false}
            onEdit={noop}
            onDelete={noop}
          />
          <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", alignItems: "center" }}>
            <Button text="Save" />
            <Button text="Nevermind" variant="secondary" />
            <Button variant="icon" icon="gear" title="Manage" />
            <RowButton glyph aria-label="Previous month">
              ‹
            </RowButton>
            <RowButton>edit budgets</RowButton>
          </div>
        </div>
      </MemoryRouter>,
    );

    // The first entry's phone actions drawer ("…") open, the rest closed.
    act(() => (v.container.querySelector(".EntryList__more") as HTMLButtonElement).click());
    expect(v.container.querySelector(".EntryList__drawer")).not.toBeNull();
    await v.sizes("ledger parts");
  });
});
