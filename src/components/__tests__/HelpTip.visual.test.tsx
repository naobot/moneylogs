import { describe, it, expect } from "vite-plus/test";
import { act } from "react";
import HelpTip from "@/components/HelpTip";
import { useVisualHarness } from "@/test/visual";

describe("HelpTip (visual)", () => {
  const v = useVisualHarness();

  it("renders the open tooltip beside its label", async () => {
    v.render(
      <div style={{ padding: "2rem 6rem" }}>
        <span>monthly budget </span>
        <HelpTip label="About the monthly budget">
          Spending past this line turns the chart's frame to a warning.
        </HelpTip>
      </div>,
    );

    // Focus opens it straight away (hover waits a beat).
    act(() => v.container.querySelector<HTMLButtonElement>(".HelpTip")!.focus());

    const panel = document.querySelector<HTMLElement>("[role=tooltip]");
    expect(panel).not.toBeNull();
    await expect.poll(() => panel!.style.visibility).not.toBe("hidden");
    await v.snapshot("help tip open");
  });
});
