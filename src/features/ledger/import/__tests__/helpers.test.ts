import { describe, it, expect } from "vite-plus/test";
import { parseCsv } from "../csv";
import { detectDateOrder, toIsoDate } from "../dates";
import { buildNote, decodeBytes, parseAmount } from "../text";
import { MAX_NOTE_LENGTH } from "@/utils/ledger";

const BOM = String.fromCharCode(0xfeff);

describe("parseCsv", () => {
  it("splits plain rows and drops blank lines", () => {
    expect(parseCsv("a,b\n\n1,2\n")).toEqual([
      ["a", "b"],
      ["1", "2"],
    ]);
  });

  it("handles quotes, doubled quotes, embedded commas and newlines", () => {
    expect(parseCsv('x,"a ""b"", c","line\nbreak"')).toEqual([["x", 'a "b", c', "line\nbreak"]]);
  });

  it("handles CRLF, a BOM, a missing trailing newline and empty fields", () => {
    expect(parseCsv(BOM + "a,b\r\n1,\r\n,2")).toEqual([
      ["a", "b"],
      ["1", ""],
      ["", "2"],
    ]);
  });
});

describe("toIsoDate", () => {
  it("reads each order and pads", () => {
    expect(toIsoDate("2024/1/5", "YMD")).toBe("2024-01-05");
    expect(toIsoDate("01/05/2024", "MDY")).toBe("2024-01-05");
    expect(toIsoDate("05.01.2024", "DMY")).toBe("2024-01-05");
  });

  it("rejects impossible or malformed dates", () => {
    expect(toIsoDate("2024/02/30", "YMD")).toBeUndefined();
    expect(toIsoDate("13/01/2024", "MDY")).toBeUndefined();
    expect(toIsoDate("24/01/05", "YMD")).toBeUndefined();
    expect(toIsoDate("yesterday", "YMD")).toBeUndefined();
  });
});

describe("detectDateOrder", () => {
  it("spots year-first", () => {
    expect(detectDateOrder(["2024-01-02"])).toBe("YMD");
  });

  it("uses any day over 12 to tell DMY from MDY", () => {
    expect(detectDateOrder(["01/02/2024", "25/02/2024"])).toBe("DMY");
    expect(detectDateOrder(["01/02/2024", "02/25/2024"])).toBe("MDY");
  });

  it("gives up when every date is ambiguous or they contradict", () => {
    expect(detectDateOrder(["01/02/2024", "03/04/2024"])).toBeUndefined();
    expect(detectDateOrder(["25/01/2024", "01/25/2024"])).toBeUndefined();
  });
});

describe("parseAmount", () => {
  it("strips symbols and thousands separators", () => {
    expect(parseAmount("-1,200")).toBe(-1200);
    expect(parseAmount("¥1,200")).toBe(1200);
    expect(parseAmount("$12.34")).toBe(12.34);
    expect(parseAmount("−5.00")).toBe(-5);
  });

  it("is NaN without digits", () => {
    expect(parseAmount("")).toBeNaN();
    expect(parseAmount("$")).toBeNaN();
  });
});

describe("buildNote", () => {
  it("joins non-empty parts", () => {
    expect(buildNote(" Cafe ", "", undefined, "latte")).toBe("Cafe — latte");
    expect(buildNote("", " ")).toBeUndefined();
  });

  it("cuts to the note limit without splitting an emoji", () => {
    const note = buildNote("a".repeat(MAX_NOTE_LENGTH - 1) + "😀");
    expect(note).toBe("a".repeat(MAX_NOTE_LENGTH - 1));
  });
});

describe("decodeBytes", () => {
  it("reads UTF-8 as is", () => {
    expect(decodeBytes(new TextEncoder().encode("日付"))).toBe("日付");
  });

  it("falls back to Shift-JIS", () => {
    // "日付" in Shift-JIS
    expect(decodeBytes(new Uint8Array([0x93, 0xfa, 0x95, 0x74]))).toBe("日付");
  });
});
