import { describe, it, expect } from "vite-plus/test";
import { act } from "react";
import Slides, { Slide } from "@/components/Slides/Slides";
import { useVisualHarness } from "@/test/visual";

const slides: Slide[] = [
  {
    id: "one",
    heading: "one log can feed another",
    art: <div className="Window">groceries · 4,210</div>,
    text: "A sublog's spending shows up as one category in the log it rolls up into.",
    example: "Your business log can count towards the household budget.",
  },
  {
    id: "two",
    heading: "only shared members count",
    text: "Spending by people outside the parent log stays in the sublog.",
  },
];

describe("Slides (visual)", () => {
  const v = useVisualHarness();

  it("renders the first slide, with skip and next", async () => {
    v.render(<Slides isOpen title="what's a sublog?" slides={slides} onClose={() => {}} />);

    expect(document.querySelector(".Slides__skip")).not.toBeNull();
    await v.snapshot("first slide");
  });

  it("renders the last slide, with done and an action", async () => {
    v.render(
      <Slides
        isOpen
        title="what's a sublog?"
        slides={slides}
        onClose={() => {}}
        action={{ text: "Link a log", onClick: () => {} }}
      />,
    );
    const next = [...document.querySelectorAll<HTMLButtonElement>(".Slides__foot button")].find(
      (b) => b.textContent?.toLowerCase() === "next",
    )!;
    act(() => next.click());

    expect(document.querySelector(".Slides__skip")).toBeNull();
    await v.sizes("last slide with action");
  });
});
