import { describe, it, expect, beforeEach, afterEach, vi } from "vite-plus/test";
import { act } from "react";
import { createRoot, Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";

const { mutate, showToast, reportError } = vi.hoisted(() => ({
  mutate: vi.fn(),
  showToast: vi.fn(),
  reportError: vi.fn(),
}));

vi.mock("@/contexts", () => ({
  useCurrentUser: () => ({ user: { id: "doc-1", userId: "uid-1" } }),
}));
vi.mock("@/hooks/useToastContext", () => ({ useToastContext: () => ({ showToast }) }));
vi.mock("@/hooks/useLedgerQuery", () => ({
  useLedgerQuery: () => ({ updateLedgerCurrency: { mutate, isLoading: false } }),
}));
vi.mock("@/utils/reportError", () => ({ reportError }));

import LedgerCurrencySection from "@/features/ledger/components/LedgerCurrencySection";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe("LedgerCurrencySection", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    vi.clearAllMocks();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  const render = (id = "shared-1") =>
    act(() =>
      root.render(
        <MemoryRouter>
          <LedgerCurrencySection ledger={{ id, defaultCurrency: "JPY" }} />
        </MemoryRouter>,
      ),
    );

  const pick = async (value: string) => {
    const select = container.querySelector("select")!;
    await act(async () => {
      select.value = value;
      select.dispatchEvent(new Event("change", { bubbles: true }));
    });
  };

  it("shows the log's current currency", () => {
    render();
    expect(container.querySelector("select")!.value).toBe("JPY");
    expect(container.textContent).toContain("for everyone in this log");
  });

  it("saves a new currency as soon as it's picked", async () => {
    mutate.mockResolvedValueOnce(undefined);
    render();
    await pick("USD");
    expect(mutate).toHaveBeenCalledWith({ ledgerId: "shared-1", defaultCurrency: "USD" });
    expect(showToast).toHaveBeenCalledWith("New entries now start in USD", "success");
  });

  it("shows and reports a failed save", async () => {
    mutate.mockRejectedValueOnce({ code: "unavailable" });
    render();
    await pick("USD");
    expect(container.querySelector(".error-message")).not.toBeNull();
    expect(reportError).toHaveBeenCalledWith(
      { code: "unavailable" },
      { feature: "ledger", action: "update_ledger_currency" },
    );
  });

  it("points the personal log to /me instead of offering a picker", () => {
    render("personal-uid-1");
    expect(container.querySelector("select")).toBeNull();
    expect(container.querySelector("a")!.getAttribute("href")).toBe("/me#profile");
  });
});
