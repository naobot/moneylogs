import { describe, it, expect, beforeEach, afterEach, vi } from "vite-plus/test";
import { act } from "react";
import { createRoot, Root } from "react-dom/client";
import { Ledger } from "@/types/ledger";

const showToast = vi.fn();
vi.mock("@/hooks/useToastContext", () => ({ useToastContext: () => ({ showToast }) }));
// Hoisted: importEntries creates its callables at import time.
const { importCall, checkCall } = vi.hoisted(() => ({
  importCall: vi.fn(async ({ rows }: { rows: unknown[] }) => ({
    data: { created: rows.length - 1, skippedDuplicates: 1 },
  })),
  checkCall: vi.fn(async (_req: unknown) => ({
    data: { alreadyImported: [] as string[], possibleDuplicates: {} as Record<string, unknown> },
  })),
}));
vi.mock("@/config/firebase-config", () => ({ functions: {} }));
vi.mock("firebase/functions", () => ({
  httpsCallable: (_functions: unknown, name: string) =>
    name === "checkLedgerImport" ? checkCall : importCall,
}));
const { reportError, trackStep } = vi.hoisted(() => ({
  reportError: vi.fn(),
  trackStep: vi.fn(),
}));
vi.mock("@/utils/reportError", () => ({ reportError, trackStep }));

import ImportModal from "../ImportModal";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const ledger = {
  id: "L1",
  title: "home",
  defaultCurrency: "JPY",
  memberUids: ["uid-1"],
  categories: [
    { id: "food", name: "食費", order: 0 },
    { id: "fun", name: "Fun", order: 1 },
  ],
} as unknown as Ledger;

const MF = [
  "計算対象,日付,内容,金額（円）,保有金融機関,大項目,中項目,メモ,振替,ID",
  "1,2024/11/03,ローソン,-1280,カード,食費,食料品,,0,a1",
  "1,2024/11/04,映画,-1800,カード,趣味・娯楽,映画,,0,a2",
  "1,2024/12/01,セブン,-500,カード,食費,外食,,0,a3",
  "1,2024/12/01,振替,-9000,銀行,未分類,,,1,a4",
].join("\n");

describe("ImportModal", () => {
  let container: HTMLDivElement;
  let root: Root;
  const onClose = vi.fn();

  beforeEach(() => {
    window.localStorage.clear();
    importCall.mockClear();
    checkCall.mockClear();
    reportError.mockClear();
    trackStep.mockClear();
    showToast.mockClear();
    onClose.mockClear();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    act(() => root.render(<ImportModal isOpen ledger={ledger} onClose={onClose} />));
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    document.body.innerHTML = "";
  });

  const chooseFile = async (text: string) => {
    const input = document.querySelector<HTMLInputElement>('input[type="file"]')!;
    const file = new File([text], "export.csv", { type: "text/csv" });
    Object.defineProperty(input, "files", { value: [file], configurable: true });
    await act(async () => {
      input.dispatchEvent(new Event("change", { bubbles: true }));
    });
  };

  const importButton = () =>
    [...document.querySelectorAll("button")].find((b) => b.textContent?.startsWith("Import"))!;

  it("maps matching categories, skips the rest and previews by month", async () => {
    await chooseFile(MF);

    expect(document.body.textContent).toContain("3 spending rows from MoneyForward ME");
    expect(document.body.textContent).toContain("left out: 1 transfers");
    const food = document.querySelector<HTMLSelectElement>(
      'select[aria-label="Ledger category for 食費"]',
    )!;
    const hobby = document.querySelector<HTMLSelectElement>(
      'select[aria-label="Ledger category for 趣味・娯楽"]',
    )!;
    expect(food.value).toBe("food");
    expect(hobby.value).toBe("");
    expect(document.body.textContent).toContain("1 row in skipped categories");
    expect(importButton().textContent).toBe("Import 2");

    act(() => {
      hobby.value = "fun";
      hobby.dispatchEvent(new Event("change", { bubbles: true }));
    });
    expect(importButton().textContent).toBe("Import 3");
  });

  it("imports the mapped rows, reports duplicates and remembers the mapping", async () => {
    await chooseFile(MF);
    await act(async () => importButton().click());

    expect(importCall).toHaveBeenCalledTimes(1);
    const sent = importCall.mock.calls[0][0] as {
      ledgerId: string;
      source: string;
      rows: unknown[];
    };
    expect(sent.ledgerId).toBe("L1");
    expect(sent.source).toBe("moneyforward");
    expect(sent.rows).toHaveLength(2);
    expect(showToast).toHaveBeenCalledWith("Imported 1 entries. 1 were already here.", "success");
    expect(onClose).toHaveBeenCalled();
    expect(JSON.parse(window.localStorage.getItem("ML__importMapping_L1_moneyforward")!)).toEqual({
      食費: "food",
      "趣味・娯楽": "",
    });
  });

  it("explains files it can't read", async () => {
    await chooseFile("date,amount\n2024-01-01,5");
    expect(document.body.textContent).toContain("doesn't look like a MoneyForward ME or YNAB");
    expect(importButton().disabled).toBe(true);
  });

  it("asks for the date order when a YNAB file is ambiguous", async () => {
    await chooseFile(
      [
        "Account,Flag,Date,Payee,Category Group/Category,Category Group,Category,Memo,Outflow,Inflow,Cleared",
        'A,,01/02/2024,Cafe,Fun,,,,"$4.00",,',
      ].join("\n"),
    );
    const order = document.querySelector<HTMLSelectElement>("#import-date-order")!;
    act(() => {
      order.value = "DMY";
      order.dispatchEvent(new Event("change", { bubbles: true }));
    });
    expect(document.body.textContent).toContain("1 spending row from YNAB");
    expect(document.querySelector("#import-currency")).not.toBeNull();
  });

  describe("Sentry reporting", () => {
    const MF_HEADER = "計算対象,日付,内容,金額（円）,保有金融機関,大項目,中項目,メモ,振替,ID";

    it("stays quiet for a clean file and leaves breadcrumbs through the import", async () => {
      await chooseFile(MF);
      await act(async () => importButton().click());

      expect(reportError).not.toHaveBeenCalled();
      expect(trackStep).toHaveBeenCalledWith("ledger_import", "Import file read", {
        source: "moneyforward",
        rows: 3,
        transfer: 1,
        income: 0,
        excluded: 0,
        invalid: 0,
      });
      expect(trackStep).toHaveBeenCalledWith("ledger_import", "Import started", {
        source: "moneyforward",
        rows: 2,
        alreadyImported: 0,
        duplicatesIncluded: 0,
        mappedCategories: 1,
        skippedCategories: 1,
      });
      expect(trackStep).toHaveBeenCalledWith("ledger_import", "Import finished", {
        created: 1,
        skippedDuplicates: 1,
      });
    });

    it("warns once when a supported export has unreadable rows", async () => {
      await chooseFile([MF_HEADER, "1,11月3日,ローソン,-1280,カード,食費,,,0,a1"].join("\n"));

      expect(reportError).toHaveBeenCalledTimes(1);
      const [error, context] = reportError.mock.calls[0];
      expect((error as Error).message).toBe("Import file had unreadable rows");
      expect(context).toMatchObject({
        feature: "ledger_import",
        action: "parse_file",
        level: "warning",
        tags: { source: "moneyforward" },
        extra: { invalid: 1, kept: 0 },
      });
      // Column labels only, never row contents.
      expect(JSON.stringify(context)).not.toContain("ローソン");
    });

    it("warns when a supported export is missing columns", async () => {
      await chooseFile("計算対象,日付,振替\n1,2024/01/01,0");
      expect(reportError).toHaveBeenCalledWith(expect.any(Error), {
        feature: "ledger_import",
        action: "parse_file",
        level: "warning",
        tags: { source: "moneyforward" },
        extra: { columns: ["計算対象", "日付", "振替"] },
      });
    });

    it("doesn't report a file from another app, which is the user's mistake", async () => {
      await chooseFile("date,amount\n2024-01-01,5");
      expect(reportError).not.toHaveBeenCalled();
      expect(trackStep).toHaveBeenCalledWith("ledger_import", "Import file not usable", {
        reason: "unknown-format",
      });
    });

    it("reports a failed import with how far it got", async () => {
      const failure = Object.assign(new Error("boom"), { code: "functions/internal" });
      importCall.mockRejectedValueOnce(failure);
      await chooseFile(MF);
      await act(async () => importButton().click());

      expect(reportError).toHaveBeenCalledWith(failure, {
        feature: "ledger_import",
        action: "import_entries",
        tags: { source: "moneyforward" },
        extra: { done: 0, total: 2 },
      });
      expect(document.body.textContent).toContain("The import stopped partway");
      expect(onClose).not.toHaveBeenCalled();
    });
  });

  describe("duplicate check", () => {
    const check = (data: { alreadyImported?: string[]; possibleDuplicates?: object }) =>
      checkCall.mockResolvedValueOnce({
        data: { alreadyImported: [], possibleDuplicates: {}, ...data },
      } as never);

    it("checks the file's rows before importing, without categories or notes", async () => {
      await chooseFile(MF);
      expect(checkCall).toHaveBeenCalledWith({
        ledgerId: "L1",
        source: "moneyforward",
        rows: [
          { externalId: "mf:a1", date: "2024-11-03", amount: 1280, currency: "JPY" },
          { externalId: "mf:a2", date: "2024-11-04", amount: 1800, currency: "JPY" },
          { externalId: "mf:a3", date: "2024-12-01", amount: 500, currency: "JPY" },
        ],
      });
    });

    it("leaves out rows imported before and says how many are new", async () => {
      check({ alreadyImported: ["mf:a1"] });
      await chooseFile(MF);

      expect(document.body.textContent).toContain(
        "1 already imported, so it'll be left out. 2 new.",
      );
      // a3 is the only new food row; a2's category is skipped.
      expect(importButton().textContent).toBe("Import 1");
      await act(async () => importButton().click());
      const sent = importCall.mock.calls[0][0] as { rows: Array<{ externalId: string }> };
      expect(sent.rows.map((r) => r.externalId)).toEqual(["mf:a3"]);
    });

    it("says when there's nothing new", async () => {
      check({ alreadyImported: ["mf:a1", "mf:a2", "mf:a3"] });
      await chooseFile(MF);
      expect(document.body.textContent).toContain("Nothing new in this file.");
      expect(importButton().disabled).toBe(true);
    });

    it("leaves possible duplicates out until ticked", async () => {
      check({
        possibleDuplicates: { "mf:a3": { entryId: "e9", note: "7-11", authorName: "Mina" } },
      });
      await chooseFile(MF);

      expect(document.body.textContent).toContain("already logged?");
      expect(document.body.textContent).toContain("matches “7-11” by Mina");
      expect(importButton().textContent).toBe("Import 1");

      const toggle = document.querySelector<HTMLButtonElement>('[role="checkbox"]')!;
      expect(toggle.getAttribute("aria-checked")).toBe("false");
      act(() => toggle.click());
      expect(toggle.getAttribute("aria-checked")).toBe("true");
      expect(importButton().textContent).toBe("Import 2");
    });

    it("waits for the check before allowing an import", async () => {
      let resolve!: (value: unknown) => void;
      checkCall.mockReturnValueOnce(new Promise((r) => (resolve = r)) as never);
      await chooseFile(MF);

      expect(document.body.textContent).toContain("checking which rows are already in this log");
      expect(importButton().disabled).toBe(true);
      await act(async () => resolve({ data: { alreadyImported: [], possibleDuplicates: {} } }));
      expect(importButton().disabled).toBe(false);
    });

    it("still allows importing when the check fails, and tells Sentry", async () => {
      const failure = new Error("unavailable");
      checkCall.mockRejectedValueOnce(failure);
      await chooseFile(MF);

      expect(document.body.textContent).toContain("Couldn't check this log for duplicates");
      expect(importButton().textContent).toBe("Import 2");
      expect(reportError).toHaveBeenCalledWith(failure, {
        feature: "ledger_import",
        action: "check_duplicates",
        level: "warning",
        tags: { source: "moneyforward" },
        extra: { rows: 3 },
      });
    });
  });
});
