import { describe, it, expect } from "vite-plus/test";
import SectionLabel from "@/components/SectionLabel";
import { useVisualHarness } from "@/test/visual";

/** Every kind of section label, in the order a page might use them. */
const Labels = () => (
  <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
    <SectionLabel>breakdown</SectionLabel>
    <SectionLabel count={3}>new</SectionLabel>
    <SectionLabel aside={<SectionLabel.Action>edit</SectionLabel.Action>}>budget</SectionLabel>
    <SectionLabel
      count={9}
      aside={<SectionLabel.Action aria-label="see all 9 friends">see all 9</SectionLabel.Action>}
    >
      friends
    </SectionLabel>
    <SectionLabel variant="today" as="h3" aside="¥ 3,140">
      today · thu 26 nov
    </SectionLabel>
    <SectionLabel as="h3" aside="¥ 6,900">
      wed 25 nov
    </SectionLabel>
    <SectionLabel aside="¥ 128,400">
      <span className="keep-case">Groceries and household bits for the flat, shared</span>
    </SectionLabel>
  </div>
);

describe("SectionLabel (visual)", () => {
  const v = useVisualHarness();

  it("draws names, counts, totals, actions and today's bar", async () => {
    v.render(<Labels />);
    expect(v.container.querySelectorAll(".SectionLabel")).toHaveLength(7);
    await v.sizes("section labels");
  });

  it("themes today's bar in night shift", async () => {
    v.night();
    v.render(<Labels />);
    await v.snapshot("section labels · night");
  });
});
