import { afterEach, describe, it, expect, vi } from "vite-plus/test";
import { page } from "vite-plus/test/browser/context";
import { MemoryRouter } from "react-router-dom";

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

const PHONE = { width: 390, height: 844 };
// The browser's size in the visual project unless a test changes it.
const DEFAULT = { width: 414, height: 896 };

const noop = async () => {};

// One phone snapshot per Display → UI size: the same ledger parts, so S / M / L can be
// compared side by side. M must match the snapshots from before UI size existed.
describe("UI size (visual)", () => {
  const v = useVisualHarness();

  afterEach(async () => {
    await page.viewport(DEFAULT.width, DEFAULT.height);
  });

  it.each(["s", "m", "l"] as const)("renders the ledger's parts at UI size %s", async (size) => {
    await page.viewport(PHONE.width, PHONE.height);
    v.uiSize(size);
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

    expect(document.documentElement.dataset.uiSize).toBe(size === "m" ? undefined : size);
    await v.snapshot(`ledger parts · ui size ${size}`);
  });
});
