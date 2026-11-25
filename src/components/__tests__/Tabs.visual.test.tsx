import { describe, it, expect } from "vite-plus/test";
import Tabs from "@/components/Tabs";
import { useVisualHarness } from "@/test/visual";

const TABS = [
  { id: "posts", label: "posts" },
  { id: "summary", label: "summary" },
  { id: "members", label: "members" },
];

describe("Tabs (visual)", () => {
  const v = useVisualHarness();

  it("renders folder tabs over a window", async () => {
    v.render(
      <div>
        <Tabs tabs={TABS} activeId="summary" onChange={() => {}} ariaLabel="Sections" />
        <div className="Window" style={{ padding: "1rem" }}>
          window contents
        </div>
      </div>,
    );

    expect(v.container.querySelector("[aria-selected=true]")?.textContent).toContain("summary");
    await v.sizes("tabs with active summary");
  });
});
