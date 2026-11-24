import { describe, it, expect, beforeEach, afterEach, vi } from "vite-plus/test";
import { act } from "react";
import { createRoot, Root } from "react-dom/client";
import { LedgerCategory, LedgerSchedule } from "@/types/ledger";

const { addMutate, updateMutate, deleteMutate, reportError } = vi.hoisted(() => ({
  addMutate: vi.fn(async () => "new-id"),
  updateMutate: vi.fn(async () => true),
  deleteMutate: vi.fn(async () => true),
  reportError: vi.fn(),
}));

vi.mock("@/contexts", () => ({
  useCurrentUser: () => ({ user: { id: "doc-me", userId: "uid-me", timezone: "UTC" } }),
}));
vi.mock("@/hooks/useLedgerScheduleQuery", () => ({
  useLedgerScheduleQuery: () => ({
    addSchedule: { mutate: addMutate },
    updateSchedule: { mutate: updateMutate },
    deleteSchedule: { mutate: deleteMutate },
  }),
}));
vi.mock("@/hooks/useProfiles", () => ({
  useProfiles: () => ({
    profiles: new Map([["doc-them", { id: "doc-them", displayName: "Sam" }]]),
    isLoading: false,
  }),
  profileName: (state: { profiles: Map<string, { displayName: string }> }, id: string) =>
    state.profiles.get(id)?.displayName,
}));
vi.mock("@/utils/reportError", () => ({ reportError }));

import ScheduledPayments from "@/features/ledger/components/ScheduledPayments";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const HOUSING: LedgerCategory = { id: "housing", name: "Housing", order: 0 };

const schedule = (overrides: Partial<LedgerSchedule> = {}): LedgerSchedule => ({
  id: "s1",
  categoryId: "housing",
  label: "rent",
  amount: 1200,
  currency: "CAD",
  repeat: { every: "month", day: 1 },
  ownerUid: "uid-me",
  ownerDocId: "doc-me",
  nextDue: "2026-12-01",
  ...overrides,
});

describe("ScheduledPayments", () => {
  let container: HTMLDivElement;
  let root: Root;

  const render = (schedules: LedgerSchedule[]) =>
    act(() =>
      root.render(
        <ScheduledPayments
          ledgerId="l1"
          category={HOUSING}
          schedules={schedules}
          defaultCurrency="CAD"
        />,
      ),
    );

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

  const byLabel = <T extends HTMLElement>(label: string) =>
    container.querySelector(`[aria-label="${label}"]`) as T;
  const button = (text: string) =>
    Array.from(container.querySelectorAll("button")).find((b) => b.textContent === text)!;
  const type = (el: HTMLInputElement | HTMLSelectElement, value: string) => {
    const proto =
      el instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, "value")!.set!.call(el, value);
    el.dispatchEvent(
      new Event(el instanceof HTMLSelectElement ? "change" : "input", { bubbles: true }),
    );
  };

  it("shows each payment with when it repeats and its next day", () => {
    render([schedule()]);
    expect(container.textContent).toContain("rent");
    expect(container.textContent).toContain("monthly · 1st · next 1 dec");
  });

  it("adds a monthly payment as the current user", async () => {
    render([]);
    act(() => button("[+ scheduled payment]").click());
    act(() => type(byLabel<HTMLInputElement>("Payment name"), "phone"));
    act(() => type(byLabel<HTMLInputElement>("Payment amount"), "45.50"));
    act(() => type(byLabel<HTMLSelectElement>("Day"), "15"));
    await act(async () => button("add").click());
    expect(addMutate).toHaveBeenCalledWith({
      ledgerId: "l1",
      input: {
        categoryId: "housing",
        label: "phone",
        amount: 45.5,
        currency: "CAD",
        repeat: { every: "month", day: 15 },
      },
      owner: { uid: "uid-me", userDocId: "doc-me" },
    });
    expect(button("[+ scheduled payment]")).toBeTruthy();
  });

  it("doesn't add one that's missing its amount", async () => {
    render([]);
    act(() => button("[+ scheduled payment]").click());
    act(() => type(byLabel<HTMLInputElement>("Payment name"), "phone"));
    await act(async () => button("add").click());
    expect(addMutate).not.toHaveBeenCalled();
    expect(container.textContent).toContain("enter an amount");
  });

  it("offers a month for yearly payments", () => {
    render([]);
    act(() => button("[+ scheduled payment]").click());
    expect(byLabel("Month")).toBeNull();
    act(() => type(byLabel<HTMLSelectElement>("Repeats"), "year"));
    expect(byLabel("Month")).toBeTruthy();
  });

  it("pauses and removes the owner's own payment", async () => {
    render([schedule()]);
    await act(async () => byLabel<HTMLButtonElement>("Pause rent").click());
    expect(updateMutate).toHaveBeenCalledWith({
      ledgerId: "l1",
      scheduleId: "s1",
      changes: { paused: true },
    });
    await act(async () => byLabel<HTMLButtonElement>("Remove rent").click());
    expect(deleteMutate).toHaveBeenCalledWith({ ledgerId: "l1", scheduleId: "s1" });
  });

  it("shows who set up someone else's payment, without its controls", () => {
    render([schedule({ ownerUid: "uid-them", ownerDocId: "doc-them" })]);
    expect(container.textContent).toContain("set up by Sam");
    expect(byLabel("Edit rent")).toBeNull();
    expect(byLabel("Pause rent")).toBeNull();
  });

  it("says when a payment is paused", () => {
    render([schedule({ paused: true, nextDue: undefined })]);
    expect(container.textContent).toContain("monthly · 1st · paused");
    expect(byLabel("Resume rent")).toBeTruthy();
  });
});
