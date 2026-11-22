import { describe, it, expect, beforeEach, afterEach } from "vite-plus/test";
import { act } from "react";
import { createRoot, Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { SettingsLayout, SettingsSection } from "../SettingsLayout";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const sections: SettingsSection[] = [
  { id: "profile", title: "profile", summary: "alice · tokyo", content: <p>profile body</p> },
  { id: "friends", title: "friends", content: <p>friends body</p> },
  { id: "logs", title: "my logs", summary: "2 ongoing", content: <p>logs body</p> },
];

describe("SettingsLayout", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  const render = (at: string) =>
    act(() =>
      root.render(
        <MemoryRouter initialEntries={[at]}>
          <SettingsLayout sections={sections} />
        </MemoryRouter>,
      ),
    );

  const visibleBodies = () =>
    [...container.querySelectorAll<HTMLElement>(".SettingsLayout__body")]
      .filter((el) => !el.hidden)
      .map((el) => el.textContent);
  const current = () => container.querySelector('[aria-current="page"]')?.textContent;
  const navLink = (title: string) =>
    [...container.querySelectorAll<HTMLAnchorElement>(".SettingsLayout__navItem")].find((a) =>
      a.textContent?.startsWith(title),
    )!;

  it("shows the first section with no hash, as the phone section list", () => {
    render("/me");
    expect(visibleBodies()).toEqual(["profile body"]);
    expect(current()).toBe("profilealice · tokyo");
    expect(container.querySelector(".SettingsLayout--section")).toBeNull();
  });

  it("opens the section a hash link names", () => {
    render("/me#logs");
    expect(visibleBodies()).toEqual(["logs body"]);
    expect(container.querySelector(".SettingsLayout__paneHead h3")?.textContent).toBe("my logs");
    expect(container.querySelector(".SettingsLayout--section")).not.toBeNull();
  });

  it("switches sections from the nav, keeping the others mounted", () => {
    render("/me");
    act(() => navLink("friends").click());
    expect(visibleBodies()).toEqual(["friends body"]);
    expect(current()).toBe("friends");
    expect(container.textContent).toContain("profile body");
  });

  it("goes back to the section list from a section", () => {
    render("/me#friends");
    act(() => container.querySelector<HTMLAnchorElement>(".SettingsLayout__back")!.click());
    expect(container.querySelector(".SettingsLayout--section")).toBeNull();
  });
});
