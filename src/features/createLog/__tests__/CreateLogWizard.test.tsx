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
const me = vi.hoisted(() => ({
  tutorials: { sublogIntro: { seconds: 1 } } as { sublogIntro?: unknown },
}));
vi.mock("@/contexts", () => ({
  useCurrentUser: () => ({
    user: {
      id: "doc-1",
      userId: "uid-1",
      displayName: "Nao",
      personalLedgerId: "personal-uid-1",
      tutorials: me.tutorials,
    },
  }),
}));
const updateUserFields = vi.hoisted(() => vi.fn(async () => {}));
vi.mock("@/hooks/useUserQuery", () => ({ updateUserFields }));
vi.mock("@/hooks/useToastContext", () => ({ useToastContext: () => ({ showToast: vi.fn() }) }));
const linkSublog = vi.hoisted(() => vi.fn(async () => ({ categoryId: "sublog-new-ledger" })));
vi.mock("@/features/ledger/sublogs/sublogApi", () => ({
  linkSublog,
  sublogErrorMessage: () => ({ message: "no", expected: false }),
}));
vi.mock("@/hooks/useGetMyLedgers", () => ({
  useGetMyLedgers: () => ({
    ledgers: [
      { id: "home", title: "household", memberUids: ["uid-1", "uid-2"], categories: [] },
      { id: "personal-uid-1", title: "personal", memberUids: ["uid-1"], categories: [] },
    ],
  }),
}));
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
    linkSublog.mockClear();
    updateUserFields.mockClear();
    me.tutorials = { sublogIntro: { seconds: 1 } };
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

    expect(question()).toMatch(/part of another log/);
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
    // It stands alone unless a parent is picked.
    expect(linkSublog).not.toHaveBeenCalled();
    expect(container.querySelector("#landed")?.textContent).toBe("ledger");
  });

  it("makes the new log a sublog of the log picked, personal first", async () => {
    await click("Financial");
    typeInto("Title", "Bali 2026");
    typeInto("Max no. of participants", "1");
    await click("Next");
    const choices = Array.from(container.querySelectorAll(".Wizard__choice strong")).map(
      (el) => el.textContent,
    );
    expect(choices).toEqual(["no, it stands alone", "personal", "household"]);
    await click("personal");
    expect(container.querySelector(".Wizard__hint:last-of-type")?.textContent).toContain(
      "personal",
    );
    await click("Next"); // part of
    await click("Next"); // currency
    expect(container.querySelector(".Wizard__review")!.textContent).toContain(
      "personal, as Bali 2026",
    );
    await click("Start financial log");
    expect(linkSublog).toHaveBeenCalledWith(
      expect.objectContaining({
        childId: "new-ledger",
        parentId: "personal-uid-1",
        name: "Bali 2026",
        since: expect.stringMatching(/^\d{4}-\d{2}$/),
      }),
    );
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
    await click("Next"); // part of
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
    await click("Next"); // part of
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

  it("opens the sublog intro the first time someone reaches the step, and records it", async () => {
    me.tutorials = {};
    await click("Financial");
    typeInto("Title", "Bali 2026");
    expect(document.querySelector(".Slides")).toBeNull();
    await click("Next");
    expect(question()).toMatch(/part of another log/);
    expect(document.querySelector(".Slides")).not.toBeNull();
    const skip = Array.from(document.querySelectorAll(".Slides button")).find(
      (b) => b.textContent === "skip",
    ) as HTMLButtonElement;
    await act(async () => skip.click());
    expect(document.querySelector(".Slides")).toBeNull();
    expect(updateUserFields).toHaveBeenCalledWith("doc-1", {
      "tutorials.sublogIntro": expect.anything(),
    });
  });

  it("replays the intro from its link, but doesn't open it again by itself", async () => {
    await click("Financial");
    typeInto("Title", "Bali 2026");
    await click("Next");
    expect(document.querySelector(".Slides")).toBeNull();
    await click("what's a sublog?");
    expect(document.querySelector(".Slides")).not.toBeNull();
  });
});
