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
// A two-city list instead of the real ~1 MB one.
vi.mock("@/hooks/usePlaceIndex", async () => {
  const { buildPlaceIndex } = await import("@/utils/citySearch");
  const index = buildPlaceIndex(
    {
      v: 1,
      tz: ["Asia/Tokyo", "Europe/Paris"],
      regions: ["Kyoto", "Île-de-France"],
      countries: { JP: "Japan", FR: "France" },
      rows: [
        ["Kyoto", "JP", 0, 0],
        ["Paris", "FR", 1, 1],
      ],
    },
    [],
  );
  return { usePlaceIndex: () => ({ status: "ready", index }) };
});

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
            <Route path="/" element={<div id="landed">home</div>} />
            <Route path="/me" element={<div id="landed">me</div>} />
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
    // The timezone is already set; the display location is optional.
    expect(button("Next")!.disabled).toBe(false);
    typeInto("Show my location as", "Tokyo");
    await click("Next");
    expect(updateUserFields).toHaveBeenLastCalledWith("doc-1", {
      timezone: "Asia/Tokyo",
      timezonePlace: "<deleteField>",
      displayLocation: "Tokyo",
    });

    expect(question()).toMatch(/how should things look/);
    expect(container.querySelector("#display-section")).not.toBeNull();
    const writesBefore = updateUserFields.mock.calls.length;
    await click("Next");
    expect(updateUserFields.mock.calls.length).toBe(writesBefore);

    expect(question()).toMatch(/currency/);
    chooseCurrency("CAD");
    await click("Take me home");

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
    expect(container.querySelector("#landed")?.textContent).toBe("home");
  });

  const pickPlace = (typed: string, option: string) => {
    typeInto("I'm based in", typed);
    const li = Array.from(container.querySelectorAll<HTMLLIElement>("[role=option]")).find((el) =>
      el.textContent?.includes(option),
    );
    act(() => {
      li!.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
    });
  };
  const fieldValue = (label: string) =>
    Array.from(container.querySelectorAll(".ControlledInput"))
      .find((el) => el.querySelector("label")?.textContent === label)!
      .querySelector("input")!.value;

  it("sets the timezone from a picked city and suggests it as the location", async () => {
    render("/welcome?step=1");
    pickPlace("par", "Paris, France");
    expect(fieldValue("I'm based in")).toBe("Paris, France");
    expect(fieldValue("Show my location as")).toBe("Paris, France");

    // The suggestion follows another pick...
    pickPlace("kyo", "Kyoto, Japan");
    expect(fieldValue("Show my location as")).toBe("Kyoto, Japan");

    // ...until the user writes their own.
    typeInto("Show my location as", "Kansai");
    pickPlace("par", "Paris, France");
    expect(fieldValue("Show my location as")).toBe("Kansai");

    await click("Next");
    expect(updateUserFields).toHaveBeenLastCalledWith("doc-1", {
      timezone: "Europe/Paris",
      timezonePlace: "Paris, France",
      displayLocation: "Kansai",
    });
  });

  it("resumes at the step in the URL after a refresh", () => {
    render("/welcome?step=2");
    expect(question()).toMatch(/how should things look/);
  });

  it("carries on to where they were headed", async () => {
    render(`/welcome?step=3&next=${encodeURIComponent("/g/abc/invite")}`);
    await click("Finish");
    expect(container.querySelector("#landed")?.textContent).toBe("invite");
  });

  it("lands on Home rather than settings", async () => {
    render(`/welcome?step=3&next=${encodeURIComponent("/me#logs")}`);
    await click("Take me home");
    expect(container.querySelector("#landed")?.textContent).toBe("home");
  });

  it("ignores an off-site next", async () => {
    render(`/welcome?step=3&next=${encodeURIComponent("//evil.com")}`);
    await click("Take me home");
    expect(container.querySelector("#landed")?.textContent).toBe("home");
  });

  it("stays put and says so when a save fails", async () => {
    updateUserFields.mockRejectedValueOnce(new Error("offline"));
    render("/welcome");
    await click("Next");
    expect(question()).toMatch(/what should we call you/);
    expect(container.querySelector(".error-message")).not.toBeNull();
  });
});
