import { describe, it, expect, beforeEach, afterEach, vi } from "vite-plus/test";
import { act } from "react";
import { createRoot, Root } from "react-dom/client";
import { MemoryRouter, Route, Routes } from "react-router-dom";

const { updateUserFields, ensurePersonalLedger, updateProfile } = vi.hoisted(() => ({
  updateUserFields: vi.fn(async () => undefined),
  ensurePersonalLedger: vi.fn(async () => "personal-uid-1"),
  updateProfile: vi.fn(async () => undefined),
}));

const user = {
  id: "doc-1",
  userId: "uid-1",
  displayName: "nao",
  timezone: "Asia/Tokyo",
  onboardingPending: true,
};

vi.mock("@/contexts", () => ({ useCurrentUser: () => ({ user }) }));
vi.mock("@/hooks/useUserQuery", () => ({ updateUserFields }));
vi.mock("@/hooks/useLedgerQuery", () => ({ ensurePersonalLedger }));
vi.mock("firebase/auth", () => ({ updateProfile }));
vi.mock("firebase/firestore", () => ({ deleteField: () => "<deleteField>" }));
vi.mock("@/config/firebase-config", () => ({ auth: { currentUser: { uid: "uid-1" } } }));
// The real section renders a markdown preview; the wizard only needs it to be there.
vi.mock("@/features/account/DisplaySection", () => ({
  DisplaySection: () => <div id="display-section" />,
}));

import { WelcomeWizard } from "@/features/onboarding/WelcomeWizard";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe("WelcomeWizard", () => {
  let container: HTMLDivElement;
  let root: Root;

  const render = (entry: string) =>
    act(() =>
      root.render(
        <MemoryRouter initialEntries={[entry]}>
          <Routes>
            <Route path="/welcome" element={<WelcomeWizard />} />
            <Route path="/l/:id" element={<div id="landed">ledger</div>} />
            <Route path="/g/:id/invite" element={<div id="landed">invite</div>} />
          </Routes>
        </MemoryRouter>,
      ),
    );

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  const button = (text: string) =>
    Array.from(container.querySelectorAll("button")).find((b) => b.textContent?.includes(text));
  const click = async (text: string) => {
    await act(async () => button(text)!.click());
  };
  const question = () => container.querySelector(".Wizard__question")?.textContent;
  const typeInto = (label: string, value: string) => {
    const field = Array.from(container.querySelectorAll(".ControlledInput")).find(
      (el) => el.querySelector("label")?.textContent === label,
    );
    const input = field!.querySelector("input")!;
    const descriptor = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!;
    act(() => {
      descriptor.set?.call(input, value);
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
  };
  const chooseCurrency = (value: string) => {
    const select = container.querySelector<HTMLSelectElement>("#welcome-default-currency")!;
    const descriptor = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value")!;
    act(() => {
      descriptor.set?.call(select, value);
      select.dispatchEvent(new Event("change", { bubbles: true }));
    });
  };

  it("asks one thing per step, saving each, then lands on the personal log", async () => {
    render("/welcome");
    expect(question()).toMatch(/what should we call you/);

    typeInto("Display name", "  ");
    expect(button("Next")!.disabled).toBe(true);
    typeInto("Display name", " Nao ");
    await click("Next");
    expect(updateUserFields).toHaveBeenLastCalledWith("doc-1", { displayName: "Nao" });
    expect(updateProfile).toHaveBeenCalledWith(expect.anything(), { displayName: "Nao" });

    expect(question()).toMatch(/where are you based/);
    // Location is optional.
    expect(button("Next")!.disabled).toBe(false);
    typeInto("Display location", "Tokyo");
    await click("Next");
    expect(updateUserFields).toHaveBeenLastCalledWith("doc-1", { displayLocation: "Tokyo" });

    expect(question()).toMatch(/timezone/);
    await click("Next");
    expect(updateUserFields).toHaveBeenLastCalledWith("doc-1", { timezone: "Asia/Tokyo" });

    expect(question()).toMatch(/how should things look/);
    expect(container.querySelector("#display-section")).not.toBeNull();
    const writesBefore = updateUserFields.mock.calls.length;
    await click("Next");
    expect(updateUserFields.mock.calls.length).toBe(writesBefore);

    expect(question()).toMatch(/currency/);
    chooseCurrency("CAD");
    await click("Take me to my log");

    expect(ensurePersonalLedger).toHaveBeenCalledWith({
      member: { uid: "uid-1", userDocId: "doc-1" },
      defaultCurrency: "CAD",
    });
    expect(updateUserFields).toHaveBeenLastCalledWith("doc-1", {
      defaultCurrency: "CAD",
      onboardingPending: "<deleteField>",
    });
    // The personal log is made before onboarding is marked done.
    expect(ensurePersonalLedger.mock.invocationCallOrder[0]).toBeLessThan(
      updateUserFields.mock.invocationCallOrder.at(-1)!,
    );
    expect(container.querySelector("#landed")?.textContent).toBe("ledger");
  });

  it("resumes at the step in the URL after a refresh", () => {
    render("/welcome?step=3");
    expect(question()).toMatch(/how should things look/);
  });

  it("carries on to where they were headed", async () => {
    render(`/welcome?step=4&next=${encodeURIComponent("/g/abc/invite")}`);
    await click("Finish");
    expect(container.querySelector("#landed")?.textContent).toBe("invite");
  });

  it("ignores an off-site next", async () => {
    render(`/welcome?step=4&next=${encodeURIComponent("//evil.com")}`);
    await click("Take me to my log");
    expect(container.querySelector("#landed")?.textContent).toBe("ledger");
  });

  it("stays put and says so when a save fails", async () => {
    updateUserFields.mockRejectedValueOnce(new Error("offline"));
    render("/welcome");
    await click("Next");
    expect(question()).toMatch(/what should we call you/);
    expect(container.querySelector(".error-message")).not.toBeNull();
  });
});
