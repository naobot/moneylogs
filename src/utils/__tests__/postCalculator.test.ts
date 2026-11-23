import { describe, expect, it } from "vite-plus/test";
import { sumAmountsIn } from "../postCalculator";

describe("sumAmountsIn", () => {
  it("sums symbol amounts for a lone currency, as before", () => {
    expect(sumAmountsIn("ramen ¥1,200 and coffee ¥450", "JPY")).toBe(1650);
    expect(sumAmountsIn("taxi $12.50, snack $3", "CAD")).toBe(15.5);
  });

  it("reads k and 万 suffixes", () => {
    expect(sumAmountsIn("rent ¥5万", "JPY")).toBe(50000);
    expect(sumAmountsIn("dinner ₩25k", "KRW")).toBe(25000);
  });

  it("reads the code form", () => {
    expect(sumAmountsIn("- ramen · food 1,200 JPY\n- tea · food 300 JPY", "JPY")).toBe(1500);
    expect(sumAmountsIn("- bus 2.75 CAD", "CAD")).toBe(2.75);
  });

  it("doesn't count a symbol and a code on the same amount twice", () => {
    expect(sumAmountsIn("ramen ¥1,200 JPY", "JPY")).toBe(1200);
  });

  it("ignores a shared symbol when another row uses it", () => {
    const text = "coffee $5 and - bus 3 CAD";
    expect(sumAmountsIn(text, "CAD", ["CAD", "USD"])).toBe(3);
    expect(sumAmountsIn(text, "USD", ["CAD", "USD"])).toBeUndefined();
  });

  it("keeps the symbol when the other rows don't share it", () => {
    expect(sumAmountsIn("coffee $5, onigiri 200 JPY", "USD", ["USD", "JPY"])).toBe(5);
  });

  it("doesn't read another currency's code-form amount as this symbol", () => {
    expect(sumAmountsIn("$5 CAD", "USD", ["USD"])).toBeUndefined();
  });

  it("subtracts a signed code-form refund, with or without a symbol", () => {
    expect(sumAmountsIn("lunch $20, refund -$5 CAD", "CAD")).toBe(15);
    expect(sumAmountsIn("lunch $20, refund $-5 CAD", "CAD")).toBe(15);
    expect(sumAmountsIn("refund -5 CAD", "CAD")).toBe(-5);
  });

  it("doesn't leave a symbol-and-code amount for another symbol currency", () => {
    expect(sumAmountsIn("refund -$5 CAD", "USD", ["USD"])).toBeUndefined();
  });

  it("multiplies decimal k and 万 shorthand", () => {
    expect(sumAmountsIn("dinner 2.5k KRW", "KRW")).toBe(2500);
    expect(sumAmountsIn("rent 2.5万 JPY", "JPY")).toBe(25000);
  });

  it("reads an amount that starts at its decimal point", () => {
    expect(sumAmountsIn("gum .50 CAD", "CAD")).toBe(0.5);
  });

  it("doesn't take an uppercase word for a currency code", () => {
    expect(sumAmountsIn("$5 AND $3", "CAD")).toBe(8);
  });

  it("returns undefined when nothing matches", () => {
    expect(sumAmountsIn("a quiet day", "JPY")).toBeUndefined();
  });
});
