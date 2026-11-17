import { describe, it, expect, beforeEach, afterEach } from "vite-plus/test";
import { act } from "react";
import { createRoot, Root } from "react-dom/client";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";

import { Landing } from "@/features/landing/Landing";
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
  const state = useLocation().state as { view?: string } | null;
  return <div data-testid="auth-view">{state?.view ?? "none"}</div>;
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
});
