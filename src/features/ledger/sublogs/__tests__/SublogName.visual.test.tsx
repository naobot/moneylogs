import { describe, it, expect } from "vite-plus/test";
import { MemoryRouter } from "react-router-dom";
import { SublogMark, SublogName } from "../SublogName";
import { useVisualHarness } from "@/test/visual";

describe("Sublog name and mark (visual)", () => {
  const v = useVisualHarness();

  it("renders a linked category as a box in a box, openable or not", async () => {
    v.render(
      <MemoryRouter>
        <ul style={{ listStyle: "none", padding: 0, display: "grid", gap: "0.5rem" }}>
          <li style={{ display: "flex", alignItems: "center", gap: "0.5em" }}>
            <SublogMark /> <SublogName name="business" to="/l/business" />
          </li>
          <li style={{ display: "flex", alignItems: "center", gap: "0.5em" }}>
            <SublogMark /> <SublogName name="alice's travel" />
          </li>
        </ul>
      </MemoryRouter>,
    );

    expect(v.container.querySelectorAll(".SublogMark")).toHaveLength(2);
    await v.snapshot("sublog names");
  });
});
