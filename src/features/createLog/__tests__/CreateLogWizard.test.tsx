import { describe, it, expect, beforeEach, afterEach, vi } from "vite-plus/test";
import { act } from "react";
import { createRoot, Root } from "react-dom/client";
import { MemoryRouter, Route, Routes } from "react-router-dom";

const createLedgerMutate = vi.fn(async () => "new-ledger");
const addNewLogGroupMutate = vi.fn(async () => "new-group");

vi.mock("@/contexts", () => ({
  useCurrentUser: () => ({ user: { id: "doc-1", userId: "uid-1", displayName: "Nao" } }),
}));
vi.mock("@/hooks/useLedgerQuery", () => ({
  useLedgerQuery: () => ({
    createLedger: { mutate: createLedgerMutate, isLoading: false, isError: false },
  }),
}));
vi.mock("@/hooks/useLogGroupQuery", () => ({
  useLogGroupQuery: () => ({
    addNewLogGroup: { mutate: addNewLogGroupMutate, isLoading: false, isError: false },
  }),
}));

import { CreateLogWizard } from "@/features/createLog/CreateLogWizard";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe("CreateLogWizard", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    createLedgerMutate.mockClear();
    addNewLogGroupMutate.mockClear();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    act(() =>
      root.render(
        <MemoryRouter initialEntries={["/create"]}>
          <Routes>
            <Route path="/create" element={<CreateLogWizard />} />
            <Route path="/l/:id" element={<div id="landed">ledger</div>} />
            <Route path="/" element={<div id="landed">home</div>} />
          </Routes>
        </MemoryRouter>,
      ),
    );
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  const buttons = () => Array.from(container.querySelectorAll("button"));
  const button = (text: string) => buttons().find((b) => b.textContent?.includes(text))!;
  const click = async (text: string) => {
    await act(async () => button(text).click());
  };
  const question = () => container.querySelector(".CreateLogWizard__question")?.textContent;
  const typeInto = (label: string, value: string) => {
    const field = Array.from(container.querySelectorAll(".ControlledInput")).find(
      (el) => el.querySelector("label")?.textContent === label,
    );
    const input = field!.querySelector("input")!;
    // React tracks the value via the prototype setter, so set it there before dispatching.
    const descriptor = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!;
    act(() => {
      descriptor.set?.call(input, value);
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
  };

  it("starts by asking for the log type, with no way forward until one is picked", () => {
    expect(question()).toMatch(/What kind of log/);
    expect(button("Next")).toBeUndefined();
  });

  it("walks a financial log through basics, currency and review, then creates it", async () => {
    await click("Financial");
    expect(question()).toMatch(/Give it a name/);
    expect(button("Next").disabled).toBe(true);

    typeInto("Title", "Groceries 2027");
    typeInto("Max no. of participants", "1");
    expect(button("Next").disabled).toBe(false);
    await click("Next");

    expect(question()).toMatch(/currency/);
    await click("Next");

    expect(question()).toMatch(/Ready to go/);
    const review = container.querySelector(".CreateLogWizard__review")!.textContent;
    expect(review).toContain("Financial log");
    expect(review).toContain("Groceries 2027");
    expect(review).toContain("Just you");

    await click("Start financial log");
    expect(createLedgerMutate).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Groceries 2027",
        max_participants: 1,
        member: { uid: "uid-1", userDocId: "doc-1" },
      }),
    );
    expect(addNewLogGroupMutate).not.toHaveBeenCalled();
    expect(container.querySelector("#landed")?.textContent).toBe("ledger");
  });

  it("asks social logs for dates and creates a log group", async () => {
    await click("Social");
    typeInto("Title", "Tokyo trip");
    await click("Next");
    expect(question()).toMatch(/When does it run/);
    await click("Next");
    await click("Start log group");
    expect(addNewLogGroupMutate).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Tokyo trip", currentUserId: "uid-1" }),
    );
    expect(createLedgerMutate).not.toHaveBeenCalled();
  });

  it("goes back a step and keeps what was entered", async () => {
    await click("Financial");
    typeInto("Title", "Home");
    await click("Next");
    await click("Back");
    const title = Array.from(container.querySelectorAll("input")).find((i) => i.value === "Home");
    expect(title).toBeDefined();
  });
});
