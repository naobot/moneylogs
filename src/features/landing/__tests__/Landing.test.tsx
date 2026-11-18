import { describe, it, expect, beforeEach, afterEach } from "vite-plus/test";
import { act } from "react";
import { createRoot, Root } from "react-dom/client";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";

import { INVITE_MESSAGES, Landing } from "@/features/landing/Landing";
import { EXTERNAL_LINKS } from "@/config/links";
import {
  SAMPLE_NOW,
  SAMPLE_RECENT,
  SAMPLE_UPCOMING,
  TRACKING,
  WITH_FRIENDS,
} from "@/features/landing/landingSamples";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

// Stands in for the auth page: shows which view the link asked for.
const AuthProbe = () => {
  const state = useLocation().state as { view?: string; from?: string } | null;
  return (
    <>
      <div data-testid="auth-view">{state?.view ?? "none"}</div>
      <div data-testid="auth-from">{state?.from ?? "none"}</div>
    </>
  );
};

describe("Landing", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    act(() =>
      root.render(
        <MemoryRouter initialEntries={["/"]}>
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/login" element={<AuthProbe />} />
          </Routes>
        </MemoryRouter>,
      ),
    );
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  const cards = (size: string) =>
    Array.from(container.querySelectorAll<HTMLAnchorElement>(`.LogCard--${size}`));
  const linkWithText = (text: string) =>
    Array.from(container.querySelectorAll<HTMLAnchorElement>("a")).find((a) =>
      a.textContent?.toLowerCase().includes(text.toLowerCase()),
    );
  const authView = () => container.querySelector('[data-testid="auth-view"]')?.textContent;

  it("lays out the example dashboard with the real card sizes", () => {
    expect(cards("large").map((c) => c.textContent)).toEqual(
      SAMPLE_NOW.map((s) => expect.stringContaining(s.title)),
    );
    expect(cards("small")).toHaveLength(SAMPLE_UPCOMING.length);
    expect(cards("compact")).toHaveLength(SAMPLE_RECENT.length);
    // New activity on an example reads like the real thing.
    const fresh = Array.from(container.querySelectorAll(".LogCard--fresh")).map(
      (c) => c.textContent,
    );
    expect(fresh).toContainEqual(expect.stringContaining("5 new posts"));
  });

  it("shows a read-only financial log under the tracking points", () => {
    const tracking = container.querySelector('[aria-labelledby="landing-tracking"]')!;
    const ledger = container.querySelector<HTMLElement>('[aria-label="Example financial log"]')!;
    // Right after "Your spending, day to day".
    expect(tracking.nextElementSibling).toBe(ledger);
    expect(ledger.querySelector<HTMLElement>(".Landing__ledger")!.inert).toBe(true);

    // The whole month's total, matching the "My spending" card, and the latest days' entries.
    expect(ledger.querySelector(".LedgerStats__strip__totals")!.textContent).toContain("642.18");
    const notes = Array.from(ledger.querySelectorAll(".EntryList__note")).map((n) => n.textContent);
    expect(notes[0]).toBe("Oat latte and a croissant");
    expect(notes).not.toContain("Pharmacy");
    // Nothing to edit or delete in a picture.
    expect(ledger.querySelectorAll(".EntryList__menu .handler")).toHaveLength(0);
  });

  it("points every example card at /login", () => {
    const all = Array.from(container.querySelectorAll<HTMLAnchorElement>(".LogCard"));
    expect(all.length).toBeGreaterThan(0);
    expect(all.every((a) => a.getAttribute("href") === "/login")).toBe(true);
  });

  it("opens registration from an example card", () => {
    act(() => cards("large")[0].click());
    expect(authView()).toBe("register");
  });

  it("opens registration from create an account", () => {
    act(() => linkWithText("create an account")!.click());
    expect(authView()).toBe("register");
  });

  it("opens the login view from sign in", () => {
    act(() => linkWithText("sign in")!.click());
    expect(authView()).toBe("login");
  });

  it("leads with personal tracking, with group logs further down", () => {
    const first = cards("large")[0];
    expect(first.textContent).toContain("just you");
    expect(first.textContent).toContain("financial");
    expect(container.querySelectorAll('[aria-labelledby="landing-tracking"] li')).toHaveLength(
      TRACKING.length,
    );
    expect(container.querySelectorAll('[aria-labelledby="landing-friends"] li')).toHaveLength(
      WITH_FRIENDS.length,
    );
    // Tracking comes before the social side.
    const headings = Array.from(container.querySelectorAll("h2")).map((h) => h.id);
    expect(headings.indexOf("landing-tracking")).toBeLessThan(headings.indexOf("landing-friends"));
  });

  it("links to the apps you can import from", () => {
    const hrefs = Array.from(
      container.querySelectorAll<HTMLAnchorElement>('[aria-labelledby="landing-tracking"] a'),
    ).map((a) => a.getAttribute("href"));
    expect(hrefs).toEqual([EXTERNAL_LINKS.moneyForward, EXTERNAL_LINKS.ynab]);
  });

  it("explains how it works in order", () => {
    const steps = Array.from(
      container.querySelectorAll('[aria-labelledby="landing-how"] li h3'),
    ).map((h) => h.textContent);
    expect(steps[0]).toBe("Start your log");
    expect(steps).toHaveLength(4);
  });

  it("has no invite bar for a plain visit", () => {
    expect(container.querySelector(".Landing__invite")).toBeNull();
    act(() => linkWithText("create an account")!.click());
    expect(container.querySelector('[data-testid="auth-from"]')?.textContent).toBe("none");
  });
});

describe("Landing from an invite link", () => {
  let container: HTMLDivElement;
  let root: Root;

  const renderAt = (path: string, element: React.ReactNode, routePath: string) =>
    act(() =>
      root.render(
        <MemoryRouter initialEntries={[path]}>
          <Routes>
            <Route path={routePath} element={element} />
            <Route path="/login" element={<AuthProbe />} />
          </Routes>
        </MemoryRouter>,
      ),
    );

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  const bar = () => container.querySelector<HTMLElement>(".Landing__invite");
  const probe = (id: string) => container.querySelector(`[data-testid="${id}"]`)?.textContent;

  it("shows the pitch with a fixed sign-up bar", () => {
    renderAt("/invite/abc123", <Landing invite="friend" />, "/invite/:code");
    expect(container.querySelector(".Landing__hero")).not.toBeNull();
    expect(bar()?.textContent).toContain(INVITE_MESSAGES.friend);
  });

  it("sends sign-up back to the invite afterwards", () => {
    renderAt("/g/trip1/invite", <Landing invite="log" />, "/g/:groupId/invite");
    act(() => bar()!.querySelector<HTMLAnchorElement>("a")!.click());
    expect(probe("auth-view")).toBe("register");
    expect(probe("auth-from")).toBe("/g/trip1/invite");
  });

  it("sends sign-in back to the invite too", () => {
    renderAt("/l/flat/invite", <Landing invite="ledger" />, "/l/:ledgerId/invite");
    const signIn = Array.from(bar()!.querySelectorAll<HTMLAnchorElement>("a")).find((a) =>
      a.textContent?.includes("sign in"),
    );
    act(() => signIn!.click());
    expect(probe("auth-view")).toBe("login");
    expect(probe("auth-from")).toBe("/l/flat/invite");
  });

  it("carries the invite through the example cards", () => {
    renderAt("/invite/abc123", <Landing invite="friend" />, "/invite/:code");
    act(() => container.querySelector<HTMLAnchorElement>(".LogCard")!.click());
    expect(probe("auth-from")).toBe("/invite/abc123");
  });
});
