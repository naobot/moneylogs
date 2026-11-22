import { describe, it, expect, vi, beforeEach } from "vite-plus/test";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { LedgerCategory } from "@/types/ledger";

const myLedgers = vi.hoisted(() =>
  vi.fn((_opts?: { enabled?: boolean }) => ({
    ledgers: [{ id: "biz", parentLink: { linkId: "L-biz" } }],
  })),
);
vi.mock("@/hooks/useGetMyLedgers", () => ({ useGetMyLedgers: myLedgers }));

import { useSublogLinks } from "../useSublogLinks";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const run = (categories: LedgerCategory[]) => {
  let result: ReadonlyMap<string, string | null> = new Map();
  const Probe = () => {
    result = useSublogLinks(categories);
    return null;
  };
  const root = createRoot(document.createElement("div"));
  act(() => root.render(<Probe />));
  act(() => root.unmount());
  return result;
};

describe("useSublogLinks", () => {
  beforeEach(() => myLedgers.mockClear());

  it("doesn't query the user's logs for a log without sublogs", () => {
    expect(run([{ id: "food", name: "food", order: 0 }]).size).toBe(0);
    expect(myLedgers).toHaveBeenCalledWith({ enabled: false });
  });

  it("links the sublogs the viewer is in, and not the others", () => {
    const links = run([
      { id: "sublog-biz", name: "business", order: 0, sublog: { linkId: "L-biz" } },
      { id: "sublog-bali", name: "bali", order: 1, sublog: { linkId: "L-bali" } },
    ]);
    expect(myLedgers).toHaveBeenCalledWith({ enabled: true });
    expect([...links]).toEqual([
      ["sublog-biz", "biz"],
      ["sublog-bali", null],
    ]);
  });
});
