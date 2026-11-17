import { describe, it, expect, beforeEach, afterEach, vi } from "vite-plus/test";
import { act } from "react";
import { createRoot, Root } from "react-dom/client";
import { Ledger } from "@/types/ledger";

const showToast = vi.fn();
vi.mock("@/hooks/useToastContext", () => ({ useToastContext: () => ({ showToast }) }));
// Hoisted: importEntries creates its callable at import time.
const { importCall } = vi.hoisted(() => ({
  importCall: vi.fn(async ({ rows }: { rows: unknown[] }) => ({
    data: { created: rows.length - 1, skippedDuplicates: 1 },
  })),
}));
vi.mock("@/config/firebase-config", () => ({ functions: {} }));
vi.mock("firebase/functions", () => ({ httpsCallable: () => importCall }));

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
});
