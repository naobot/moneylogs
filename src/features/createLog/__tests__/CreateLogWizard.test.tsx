import { describe, it, expect, beforeEach, afterEach, vi } from "vite-plus/test";
import { act } from "react";
import { createRoot, Root } from "react-dom/client";
import { MemoryRouter, Route, Routes } from "react-router-dom";

const createLedgerMutate = vi.fn(async () => "new-ledger");
const addNewLogGroupMutate = vi.fn(async () => "new-group");
const inviteFriendsToLog = vi.hoisted(() => vi.fn(async () => ({ invited: [], skipped: [] })));

const personal = vi.hoisted(() => ({
  ledger: { id: "personal-uid-1", title: "personal" } as { id: string; title: string } | undefined,
  queriedId: undefined as string | undefined,
}));
vi.mock("@/contexts", () => ({
  useCurrentUser: () => ({
    user: { id: "doc-1", userId: "uid-1", displayName: "Nao", personalLedgerId: "personal-uid-1" },
  }),
}));
vi.mock("@/hooks/useToastContext", () => ({ useToastContext: () => ({ showToast: vi.fn() }) }));
vi.mock("@/features/invites/logInvites", () => ({ inviteFriendsToLog }));
// The real picker reads friendships and profiles; a stand-in that picks one friend.
vi.mock("@/features/invites/FriendPicker", () => ({
  FriendPicker: ({ onChange }: { onChange: (ids: string[]) => void }) => (
    <button type="button" onClick={() => onChange(["friend-1"])}>
      pick friend-1
    </button>
  ),
}));
vi.mock("@/hooks/useGetLedger", () => ({
  useGetLedger: (id?: string) => {
    personal.queriedId = id;
    return { ledger: id ? personal.ledger : undefined };
  },
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
    personal.ledger = { id: "personal-uid-1", title: "personal" };
    createLedgerMutate.mockClear();
    addNewLogGroupMutate.mockClear();
    inviteFriendsToLog.mockClear();
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
  const question = () => container.querySelector(".Wizard__question")?.textContent;
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

  it("points at the personal log that already exists before asking for a type", () => {
    expect(personal.queriedId).toBe("personal-uid-1");
    const note = container.querySelector(".Wizard__note")!;
    expect(note.textContent).toContain("You already have a financial log just for you");
    expect(note.textContent).toContain("like a trip");
    expect(note.querySelector("a")!.getAttribute("href")).toBe("/l/personal-uid-1");
    expect(note.querySelector("a")!.textContent).toBe("personal");
  });

  it("says nothing about a personal log that was deleted", () => {
    personal.ledger = undefined;
    act(() =>
      root.render(
        <MemoryRouter initialEntries={["/create"]}>
          <Routes>
            <Route path="/create" element={<CreateLogWizard />} />
          </Routes>
        </MemoryRouter>,
      ),
    );
    expect(container.querySelector(".Wizard__note")).toBeNull();
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
    const review = container.querySelector(".Wizard__review")!.textContent;
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
    expect(question()).toMatch(/Invite friends/);
    await click("Next");
    await click("Start log group");
    expect(addNewLogGroupMutate).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Tokyo trip", currentUserId: "uid-1" }),
    );
    expect(createLedgerMutate).not.toHaveBeenCalled();
    // Nobody picked: no invites go out.
    expect(inviteFriendsToLog).not.toHaveBeenCalled();
  });

  it("invites the friends picked once the log exists", async () => {
    await click("Financial");
    typeInto("Title", "Flat");
    await click("Next");
    await click("Next"); // currency
    expect(question()).toMatch(/Invite friends/);
    await click("pick friend-1");
    await click("Next");
    expect(container.querySelector(".Wizard__review")!.textContent).toContain("1 friend");
    await click("Start financial log");
    expect(inviteFriendsToLog).toHaveBeenCalledWith("new-ledger", "ledger", ["friend-1"]);
    expect(container.querySelector("#landed")?.textContent).toBe("ledger");
  });

  it("skips the friends step for a log that's just for you", async () => {
    await click("Financial");
    typeInto("Title", "Mine");
    typeInto("Max no. of participants", "1");
    await click("Next");
    await click("Next"); // currency
    expect(question()).toMatch(/Ready to go/);
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
