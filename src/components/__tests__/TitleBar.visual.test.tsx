import { describe, it, expect } from "vite-plus/test";
import { MemoryRouter } from "react-router-dom";
import TitleBar from "@/components/TitleBar";
import { useVisualHarness } from "@/test/visual";

/** The bars a page could have, from bare to crowded. */
const Bars = () => (
  <MemoryRouter>
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <TitleBar title="notifications" />

      <TitleBar title={<span className="keep-case">household</span>} meta="financial · 2 members">
        <TitleBar.Action label="invite" icon="plus" />
        <TitleBar.Action label="log actions" glyph="⋯" aria-haspopup="menu" />
      </TitleBar>

      <TitleBar
        title={<span className="keep-case">Roommates - Vancouver House, spring term</span>}
        titleText="Roommates - Vancouver House, spring term"
        meta="social · 4 members"
      >
        <TitleBar.Action label="manage" icon="gear" />
        <TitleBar.Action label="categories" icon="pencil" />
        <TitleBar.Action label="import" icon="document" />
      </TitleBar>

      {/* A menu open from the bar: open is a state, so its button inverts. */}
      <TitleBar title="settings">
        <TitleBar.Action label="more" glyph="⋯" aria-haspopup="menu" aria-expanded />
      </TitleBar>
    </div>
  </MemoryRouter>
);

describe("TitleBar (visual)", () => {
  const v = useVisualHarness();

  it("draws the striped bar with titles and actions on phones", async () => {
    v.render(<Bars />);
    expect(v.container.querySelectorAll("h1")).toHaveLength(4);
    await v.sizes("title bars");
  });

  it("shows the meta line on medium screens, icons only", async () => {
    await v.viewport({ width: 1024, height: 768 });
    v.render(<Bars />);
    await v.snapshot("title bars · medium");
  });

  it("shows icon + word actions on wide screens", async () => {
    await v.viewport({ width: 1440, height: 900 });
    v.render(<Bars />);
    await v.snapshot("title bars · wide");
  });

  it("themes its stripes in night shift", async () => {
    v.night();
    v.render(<Bars />);
    await v.snapshot("title bars · night");
  });
});
