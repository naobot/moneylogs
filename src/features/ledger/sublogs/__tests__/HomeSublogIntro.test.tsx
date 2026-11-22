import { describe, it, expect, vi, beforeEach, afterEach } from "vite-plus/test";
import { act } from "react";
import { createRoot, Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";

const me = vi.hoisted(() => ({ tutorials: {} as { sublogIntro?: unknown } }));
vi.mock("@/contexts", () => ({
  useCurrentUser: () => ({ user: { id: "doc-1", userId: "u", tutorials: me.tutorials } }),
}));
const hasEntries = vi.hoisted(() => ({ value: undefined as boolean | undefined, enabled: false }));
vi.mock("@/hooks/useLedgerHasEntries", () => ({
  useLedgerHasEntries: (_id: string, enabled: boolean) => {
    hasEntries.enabled = enabled;
    return hasEntries.value;
  },
}));
vi.mock("@/hooks/useUserQuery", () => ({ updateUserFields: vi.fn(async () => {}) }));

import { HomeSublogIntro } from "../HomeSublogIntro";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe("HomeSublogIntro", () => {
  let root: Root;
  beforeEach(() => {
    me.tutorials = {};
    hasEntries.value = undefined;
    root = createRoot(document.createElement("div"));
  });
  afterEach(() => act(() => root.unmount()));

  const render = (ledgerIds: string[]) =>
    act(() =>
      root.render(
        <MemoryRouter>
          <HomeSublogIntro ledgerIds={ledgerIds} />
        </MemoryRouter>,
      ),
    );
  const open = () => !!document.querySelector(".Slides");

  it("opens for someone who's in another financial log, without checking entries", () => {
    render(["personal-u", "home"]);
    expect(open()).toBe(true);
    expect(hasEntries.enabled).toBe(false);
  });

  it("waits for a first entry when there's only the personal log", () => {
    hasEntries.value = false;
    render(["personal-u"]);
    expect(hasEntries.enabled).toBe(true);
    expect(open()).toBe(false);
    hasEntries.value = true;
    render(["personal-u"]);
    expect(open()).toBe(true);
  });

  it("never opens again once seen", () => {
    me.tutorials = { sublogIntro: { seconds: 1 } };
    render(["personal-u", "home"]);
    expect(open()).toBe(false);
    expect(hasEntries.enabled).toBe(false);
  });
});
