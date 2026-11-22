import { describe, it, expect, vi, beforeEach, afterEach } from "vite-plus/test";
import { act } from "react";
import { createRoot, Root } from "react-dom/client";
import Slides, { Slide } from "../Slides/Slides";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const slides: Slide[] = [
  { id: "a", heading: "first", text: "one" },
  { id: "b", heading: "second", text: "two", example: "for example" },
  { id: "c", heading: "third", text: "three" },
];

describe("Slides", () => {
  let root: Root;
  let container: HTMLDivElement;
  const onClose = vi.fn();
  const start = vi.fn();

  const render = (isOpen = true) =>
    act(() =>
      root.render(
        <Slides
          isOpen={isOpen}
          title="what's this?"
          slides={slides}
          onClose={onClose}
          action={{ text: "Start", onClick: start }}
        />,
      ),
    );
  const heading = () => document.querySelector(".Slides__heading")?.textContent;
  const button = (text: string) =>
    Array.from(document.querySelectorAll("button")).find(
      (b) => b.textContent?.trim().toLowerCase() === text,
    )!;
  const click = (text: string) => act(() => button(text).click());

  beforeEach(() => {
    onClose.mockClear();
    start.mockClear();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    render();
  });
  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it("steps forward and back, showing where you are", () => {
    expect(heading()).toBe("first");
    expect(button("back").disabled).toBe(true);
    click("next");
    expect(heading()).toBe("second");
    expect(document.querySelector(".Slides__example")?.textContent).toBe("for example");
    expect(document.querySelector(".Slides__dots")?.getAttribute("aria-label")).toBe(
      "slide 2 of 3",
    );
    click("back");
    expect(heading()).toBe("first");
  });

  it("reports a skip before the end, and a finish at it", () => {
    click("skip");
    expect(onClose).toHaveBeenLastCalledWith("skipped");
    click("next");
    click("next");
    expect(button("skip")).toBeUndefined();
    click("done");
    expect(onClose).toHaveBeenLastCalledWith("finished");
  });

  it("offers the extra action on the last slide only", () => {
    expect(button("start")).toBeUndefined();
    click("next");
    click("next");
    click("start");
    expect(onClose).toHaveBeenLastCalledWith("finished");
    expect(start).toHaveBeenCalled();
  });

  it("starts from the first slide each time it opens", () => {
    click("next");
    render(false);
    render(true);
    expect(heading()).toBe("first");
  });
});
