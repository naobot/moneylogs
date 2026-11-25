import { describe, it, expect } from "vite-plus/test";
import Wizard from "@/components/Wizard/Wizard";
import { useVisualHarness } from "@/test/visual";

const LABELS = ["name", "currency", "members"];
const noop = () => {};

describe("Wizard (visual)", () => {
  const v = useVisualHarness();

  it("renders the first step with a cancel button", async () => {
    v.render(
      <Wizard
        labels={LABELS}
        stepIndex={0}
        onBack={noop}
        onCancel={noop}
        onNext={noop}
        nextText="Next"
      >
        <label className="LineInput">
          what's this log for? <input defaultValue="Kyoto trip" />
        </label>
      </Wizard>,
    );

    expect(v.container.querySelector("[aria-current=step]")?.textContent).toContain("1. name");
    await v.sizes("wizard first step");
  });

  it("renders a later step with done steps and a large disabled next", async () => {
    v.render(
      <Wizard
        labels={LABELS}
        stepIndex={2}
        onBack={noop}
        onNext={noop}
        nextText="Create log"
        nextDisabled
      >
        <p>Invite friends once the log exists.</p>
      </Wizard>,
    );

    expect(v.container.querySelectorAll(".Wizard__progress__step--done")).toHaveLength(2);
    await v.sizes("wizard last step");
  });
});
