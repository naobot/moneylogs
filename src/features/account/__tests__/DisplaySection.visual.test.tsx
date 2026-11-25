import { afterEach, describe, it, expect } from "vite-plus/test";
import { page } from "vite-plus/test/browser/context";
import { act } from "react";
import { MemoryRouter } from "react-router-dom";
import { DisplaySection } from "../DisplaySection";
import { initDisplayPrefs, setDisplayPrefs } from "@/utils/displayPrefs";
import { initTheme } from "@/utils/theme";
import { useVisualHarness } from "@/test/visual";

const PHONE = { width: 390, height: 844 };
// The browser's size in the visual project unless a test changes it.
const DEFAULT = { width: 414, height: 896 };

// The /me Display drawer: the UI size row (S / M / L) above entry text, and how the
// drawer itself changes when UI size is set.
describe("DisplaySection (visual)", () => {
  const v = useVisualHarness();

  afterEach(async () => {
    act(() => setDisplayPrefs({ uiSize: "m" }));
    await page.viewport(DEFAULT.width, DEFAULT.height);
  });

  const render = () => {
    initTheme();
    initDisplayPrefs();
    v.render(
      <MemoryRouter>
        <DisplaySection />
      </MemoryRouter>,
    );
  };

  it("renders the UI size row at its default, M", async () => {
    await page.viewport(PHONE.width, PHONE.height);
    render();

    expect(v.container.querySelector('[aria-label="UI size"]')).not.toBeNull();
    await v.snapshot("display drawer · ui size m");
  });

  it.each(["s", "l"] as const)("renders the drawer after picking UI size %s", async (size) => {
    await page.viewport(PHONE.width, PHONE.height);
    render();
    act(() => setDisplayPrefs({ uiSize: size }));

    expect(document.documentElement.dataset.uiSize).toBe(size);
    await v.snapshot(`display drawer · ui size ${size}`);
  });
});
