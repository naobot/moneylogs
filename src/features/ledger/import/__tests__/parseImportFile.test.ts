import { describe, it, expect } from "vite-plus/test";
import { ImportFormatError } from "../errors";
import { detectSource, parseImportFile } from "../parseImportFile";

const BOM = String.fromCharCode(0xfeff);
const MF_HEADER = "計算対象,日付,内容,金額（円）,保有金融機関,大項目,中項目,メモ,振替,ID";
const mf = (...lines: string[]) => [MF_HEADER, ...lines].join("\r\n");

const YNAB_HEADER =
  '"Account","Flag","Date","Payee","Category Group/Category","Category Group","Category","Memo","Outflow","Inflow","Cleared"';
const ynab = (...lines: string[]) => [BOM + YNAB_HEADER, ...lines].join("\n");

const expectCode = (fn: () => unknown, code: string) => {
  try {
    fn();
  } catch (e) {
    expect(e).toBeInstanceOf(ImportFormatError);
    expect((e as ImportFormatError).code).toBe(code);
    return;
  }
  throw new Error(`expected ImportFormatError(${code})`);
};

describe("detectSource", () => {
  it("recognises both apps and nothing else", () => {
    expect(detectSource(MF_HEADER.split(","))).toBe("moneyforward");
    expect(detectSource(["Account", "Date", "Payee", "Outflow", "Inflow"])).toBe("ynab");
    expect(detectSource(["date", "amount"])).toBeUndefined();
  });
});

describe("MoneyForward ME", () => {
  it("keeps counted spending and skips transfers, excluded rows and income", () => {
    const { source, rows, skipped } = parseImportFile(
      mf(
        '1,2024/11/03,ローソン,"-1,280",三井住友カード,食費,食料品,おにぎり,0,abc1',
        "1,2024/11/04,セブン,-500,楽天カード,食費,外食,,0,abc2",
        "1,2024/11/05,給与,300000,銀行,収入,給与,,0,abc3",
        "1,2024/11/05,カード引き落とし,-50000,銀行,未分類,未分類,,1,abc4",
        "0,2024/11/06,立替,-2000,銀行,交際費,,,0,abc5",
        "1,not a date,???,-1,銀行,食費,,,0,abc6",
      ),
      { currency: "CAD" },
    );

    expect(source).toBe("moneyforward");
    expect(rows).toEqual([
      {
        externalId: "mf:abc1",
        date: "2024-11-03",
        amount: 1280,
        currency: "JPY",
        sourceCategory: "食費",
        note: "ローソン — おにぎり",
      },
      {
        externalId: "mf:abc2",
        date: "2024-11-04",
        amount: 500,
        currency: "JPY",
        sourceCategory: "食費",
        note: "セブン",
      },
    ]);
    expect(skipped).toEqual({ transfer: 1, income: 1, excluded: 1, invalid: 1 });
  });

  it("needs its columns", () => {
    expectCode(
      () => parseImportFile("計算対象,日付,振替\n1,2024/01/01,0", { currency: "JPY" }),
      "missing-columns",
    );
  });

  it("rejects a header with no rows", () => {
    expectCode(() => parseImportFile(MF_HEADER, { currency: "JPY" }), "empty");
  });
});

describe("YNAB register CSV", () => {
  it("keeps outflows, skips transfers and inflows, and uses the given currency", () => {
    const { source, rows, skipped } = parseImportFile(
      ynab(
        '"Chequing","","11/03/2024","Cafe","Everyday: Coffee","Everyday","Coffee","latte","$4.50","$0.00","Cleared"',
        '"Chequing","","11/03/2024","Cafe","Everyday: Coffee","Everyday","Coffee","latte","$4.50","$0.00","Cleared"',
        '"Chequing","","11/15/2024","Transfer : Savings","","","","","$100.00","$0.00","Cleared"',
        '"Chequing","","11/15/2024","Employer","Inflow: Ready to Assign","Inflow","Ready to Assign","","$0.00","$2,000.00","Cleared"',
        '"Visa","","11/20/2024","Grocer","","","","Split (1/2)","$1,020.10","$0.00","Uncleared"',
      ),
      { currency: "CAD" },
    );

    expect(source).toBe("ynab");
    expect(rows.map((r) => [r.date, r.amount, r.currency, r.sourceCategory, r.note])).toEqual([
      ["2024-11-03", 4.5, "CAD", "Everyday: Coffee", "Cafe — latte"],
      ["2024-11-03", 4.5, "CAD", "Everyday: Coffee", "Cafe — latte"],
      ["2024-11-20", 1020.1, "CAD", "Uncategorized", "Grocer — Split (1/2)"],
    ]);
    expect(skipped).toEqual({ transfer: 1, income: 1, excluded: 0, invalid: 0 });
  });

  it("gives identical rows distinct ids that survive a re-export", () => {
    const line = '"Chequing","","2024-11-03","Cafe","Coffee","","","","$4.50","$0.00",""';
    const first = parseImportFile(ynab(line, line), { currency: "CAD" }).rows;
    const again = parseImportFile(
      ynab('"Chequing","","2024-11-01","Bakery","Food","","","","$3.00","$0.00",""', line, line),
      { currency: "CAD" },
    ).rows;

    expect(first[0].externalId).not.toBe(first[1].externalId);
    expect(again.slice(1).map((r) => r.externalId)).toEqual(first.map((r) => r.externalId));
  });

  it("asks for the date order when every date is ambiguous", () => {
    const text = ynab('"A","","01/02/2024","Cafe","Coffee","","","","$1.00","",""');
    expectCode(() => parseImportFile(text, { currency: "CAD" }), "ambiguous-dates");
    expect(parseImportFile(text, { currency: "CAD", dateOrder: "DMY" }).rows[0].date).toBe(
      "2024-02-01",
    );
  });
});

describe("unknown files", () => {
  it("are rejected with a code", () => {
    expectCode(
      () => parseImportFile("date,amount\n2024-01-01,5", { currency: "JPY" }),
      "unknown-format",
    );
    expectCode(() => parseImportFile("", { currency: "JPY" }), "empty");
  });
});
