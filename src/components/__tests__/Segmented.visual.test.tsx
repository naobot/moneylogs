import { describe, it, expect } from "vite-plus/test";
import { MemoryRouter } from "react-router-dom";
import Segmented from "@/components/Segmented";
import TitleBar from "@/components/TitleBar";
import Disclosure from "@/components/Disclosure";
import { useVisualHarness } from "@/test/visual";

const noop = () => {};

/** The controls of a log's first screen, and of settings. */
const Controls = () => (
  <MemoryRouter>
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      {/* A log's header: the title bar and its view toggle are one unit. */}
      <div>
        <TitleBar title={<span className="keep-case">household</span>}>
          <TitleBar.Action label="log actions" glyph="⋯" />
        </TitleBar>
        <Segmented
          aria-label="View"
          flush
          value="entries"
          options={[
            { id: "entries", label: "entries", to: "/l/abc" },
            { id: "stats", label: "stats", to: "/l/abc/stats" },
          ]}
        />
      </div>

      <Segmented
        aria-label="Period"
        weight="sub"
        value="month"
        onChange={noop}
        options={[
          { id: "week", label: "week" },
          { id: "month", label: "month" },
          { id: "year", label: "year" },
        ]}
      />

      <Segmented
        aria-label="Text size"
        weight="sub"
        value="m"
        onChange={noop}
        options={[
          { id: "s", label: "S", ariaLabel: "small" },
          { id: "m", label: "M", ariaLabel: "medium" },
          { id: "l", label: "L", ariaLabel: "large" },
        ]}
      />

      <Segmented
        aria-label="Charts"
        weight="sub"
        value="colour"
        onChange={noop}
        options={[
          { id: "colour", label: "colour" },
          { id: "mono", label: "mono" },
        ]}
      />
    </div>
  </MemoryRouter>
);

const Disclosures = () => (
  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
    <Disclosure title="scheduled payments" note="3">
      <p>rent · ¥ 85,000</p>
    </Disclosure>
    <Disclosure title="breakdown" note="4 categories" defaultOpen>
      <div>
        groceries · 38%
        <br />
        dining out · 22%
        <br />
        transport · 14%
      </div>
    </Disclosure>
    <Disclosure title="a much longer title that runs out of room on a phone" note="12 items">
      <p>…</p>
    </Disclosure>
  </div>
);

describe("Segmented + Disclosure (visual)", () => {
  const v = useVisualHarness();

  it("draws primary and sub-choice segmented controls", async () => {
    v.render(<Controls />);
    expect(v.container.querySelectorAll(".Segmented")).toHaveLength(4);
    await v.sizes("segmented");
  });

  it("draws folded and open disclosures", async () => {
    v.render(<Disclosures />);
    expect(v.container.querySelectorAll("[aria-expanded='true']")).toHaveLength(1);
    await v.sizes("disclosures");
  });

  it("themes both in night shift", async () => {
    v.night();
    v.render(
      <>
        <Controls />
        <Disclosures />
      </>,
    );
    await v.snapshot("segmented and disclosures · night");
  });
});
