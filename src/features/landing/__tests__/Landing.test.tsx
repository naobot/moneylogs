import { describe, it, expect, beforeEach, afterEach } from "vite-plus/test";
import { act } from "react";
import { createRoot, Root } from "react-dom/client";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";

import { Landing } from "@/features/landing/Landing";
import { SAMPLE_NOW, SAMPLE_RECENT, SAMPLE_UPCOMING } from "@/features/landing/landingSamples";

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
    expect(container.querySelector(".LogCard--fresh")?.textContent).toContain("5 new posts");
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

  it("explains how it works in order", () => {
    const steps = Array.from(container.querySelectorAll(".Landing__steps li h3")).map(
      (h) => h.textContent,
    );
    expect(steps[0]).toBe("Start a log");
    expect(steps).toHaveLength(4);
  });
});
