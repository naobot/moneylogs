import { afterEach, describe, it, expect } from "vite-plus/test";
import { page } from "vite-plus/test/browser/context";
import CategoryManager from "../CategoryManager";
import { ToastProvider } from "@/contexts/ToastContext";
import { LedgerCategory } from "@/types/ledger";
import { useVisualHarness } from "@/test/visual";
import "../Ledger.scss";

const CATEGORIES: LedgerCategory[] = [
  { id: "food", name: "food", order: 0, budget: { JPY: 30000 } },
  { id: "transport", name: "transport", order: 1 },
  { id: "home", name: "home", order: 2 },
  { id: "old", name: "old stuff", order: 3, archived: true },
];

const PHONE = { width: 390, height: 844 };
// The browser's size in the visual project unless a test changes it.
const DEFAULT = { width: 414, height: 896 };

// The categories window on a phone, with the "make it a sublog" line under the add form
// (only offered on logs that can have sublogs).
describe("CategoryManager (visual)", () => {
  const v = useVisualHarness();

  afterEach(async () => {
    await page.viewport(DEFAULT.width, DEFAULT.height);
  });

  it("renders the category list with the sublog entry point", async () => {
    await page.viewport(PHONE.width, PHONE.height);
    v.render(
      <ToastProvider>
        <CategoryManager
          isOpen
          categories={CATEGORIES}
          defaultCurrency="JPY"
          onClose={() => {}}
          onSave={async () => {}}
          checkInUse={async () => false}
          onSublogHelp={() => {}}
        />
      </ToastProvider>,
    );

    expect(document.body.textContent).toContain("make it a sublog");
    await v.snapshot("categories window with sublog line");
  });
});
