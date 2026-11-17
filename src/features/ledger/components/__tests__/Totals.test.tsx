import { describe, it, expect, beforeEach, afterEach } from "vite-plus/test";
import { act } from "react";
import { createRoot, Root } from "react-dom/client";

import { CurrencyAmounts } from "@/types/ledger";
import { formatAmount, orderedCurrencies } from "@/utils/ledgerEntries";
import Totals from "../Totals";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe("Totals", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  const amounts = () =>
    Array.from(container.querySelectorAll(".Totals__amount")).map((el) => el.textContent);

  it("renders one amount per currency, in the usual order, marked as multi", () => {
    const totals: CurrencyAmounts = { JPY: 1200, CAD: 15.5 };
    act(() => root.render(<Totals totals={totals} />));
    expect(amounts()).toEqual(orderedCurrencies(totals).map((c) => formatAmount(totals[c]!, c)));
    expect(container.querySelector(".Totals")!.classList).toContain("Totals--multi");
  });

  it("isn't marked multi with a single currency, so it never stacks", () => {
    act(() => root.render(<Totals totals={{ CAD: 9 }} />));
    expect(amounts()).toEqual([formatAmount(9, "CAD")]);
    expect(container.querySelector(".Totals")!.classList).not.toContain("Totals--multi");
  });
});
