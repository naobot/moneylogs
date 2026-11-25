import { describe, it, expect } from "vite-plus/test";
import TutorialTooltip from "@/components/TutorialTooltip";
import { useVisualHarness } from "@/test/visual";

const anchorStyle = { display: "inline-block", border: "1px solid", padding: "0.5rem 1rem" };

describe("TutorialTooltip (visual)", () => {
  const v = useVisualHarness();

  it("renders a multi-step bubble below its anchor", async () => {
    v.render(
      <div style={{ padding: "1rem 4rem 12rem" }}>
        <span style={anchorStyle}>
          + new post
          <TutorialTooltip
            text="Log what you spent here. Pick a currency and we'll convert it."
            progress="2/9"
            onDismiss={() => {}}
            onSkip={() => {}}
          />
        </span>
      </div>,
    );

    const bubble = document.querySelector<HTMLElement>(".TutorialTooltip");
    await expect.poll(() => bubble!.style.visibility).not.toBe("hidden");
    expect(bubble!.classList.contains("TutorialTooltip--bottom")).toBe(true);
    await v.sizes("tutorial tooltip below");
  });

  it("renders a bubble above its anchor", async () => {
    v.render(
      <div style={{ padding: "12rem 4rem 1rem" }}>
        <span style={anchorStyle}>
          summary
          <TutorialTooltip
            text="Archive a log to see who spent what."
            position="top"
            onDismiss={() => {}}
          />
        </span>
      </div>,
    );

    const bubble = document.querySelector<HTMLElement>(".TutorialTooltip");
    await expect.poll(() => bubble!.style.visibility).not.toBe("hidden");
    expect(bubble!.classList.contains("TutorialTooltip--top")).toBe(true);
    await v.snapshot("tutorial tooltip above");
  });

  it("points at the pointAt element, not the centre of a wider anchor", async () => {
    v.render(
      <div style={{ padding: "1rem 1rem 12rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", width: 360 }}>
          <span style={anchorStyle}>amount</span>
          <select aria-label="Currency" style={{ width: 70 }}>
            <option>CAD</option>
          </select>
          <TutorialTooltip
            text="Switch it for anything you paid in another."
            pointAt="select"
            onDismiss={() => {}}
          />
        </div>
      </div>,
    );

    const bubble = document.querySelector<HTMLElement>(".TutorialTooltip")!;
    await expect.poll(() => bubble.style.visibility).not.toBe("hidden");
    const select = document.querySelector("select")!.getBoundingClientRect();
    const arrowX =
      bubble.getBoundingClientRect().left +
      parseFloat(bubble.style.getPropertyValue("--tooltip-arrow-x"));
    expect(Math.abs(arrowX - (select.left + select.width / 2))).toBeLessThan(1);
    await v.snapshot("tutorial tooltip pointing at a child");
  });
});
