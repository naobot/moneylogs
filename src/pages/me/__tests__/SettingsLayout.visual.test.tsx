import { afterEach, describe, it, expect } from "vite-plus/test";
import { page } from "vite-plus/test/browser/context";
import { MemoryRouter } from "react-router-dom";
import { SettingsLayout, SettingsSection } from "../SettingsLayout";
import { useVisualHarness } from "@/test/visual";
import "../me.scss";

const sections: SettingsSection[] = [
  { id: "profile", title: "profile", summary: "alice · tokyo", content: "hidden" },
  { id: "friends", title: "friends", summary: "3 friends · 1 request", content: "hidden" },
  {
    id: "display",
    title: "display",
    summary: "night shift · 12h",
    content: <p>Night shift, date format and currency settings live here.</p>,
  },
  { id: "achievements", title: "achievements", summary: "3 unlocked", content: "hidden" },
];

const PHONE = { width: 390, height: 844 };
const DESKTOP = { width: 1280, height: 800 };
// The browser's size in the visual project unless a test changes it.
const DEFAULT = { width: 414, height: 896 };

describe("SettingsLayout (visual)", () => {
  const v = useVisualHarness();

  afterEach(async () => {
    await page.viewport(DEFAULT.width, DEFAULT.height);
  });

  const render = (at: string) =>
    v.render(
      <MemoryRouter initialEntries={[at]}>
        <SettingsLayout sections={sections} />
      </MemoryRouter>,
    );

  it("renders the section nav beside the chosen section", async () => {
    await page.viewport(DESKTOP.width, DESKTOP.height);
    render("/me#display");

    expect(v.container.querySelector('[aria-current="page"]')?.textContent).toContain("display");
    await v.snapshot("settings nav and section");
  });

  it("renders only the section list on a phone", async () => {
    await page.viewport(PHONE.width, PHONE.height);
    render("/me");

    expect(getComputedStyle(v.container.querySelector(".SettingsLayout__pane")!).display).toBe(
      "none",
    );
    await v.snapshot("phone section list");
  });

  it("renders one section with a way back on a phone", async () => {
    await page.viewport(PHONE.width, PHONE.height);
    render("/me#display");

    expect(getComputedStyle(v.container.querySelector(".SettingsLayout__nav")!).display).toBe(
      "none",
    );
    await v.snapshot("phone section");
  });
});
