import { describe, it, expect } from "vite-plus/test";
import RowButton from "@/components/RowButton";
import { useVisualHarness } from "@/test/visual";

describe("RowButton (visual)", () => {
  const v = useVisualHarness();

  it("renders word and glyph labels", async () => {
    v.render(
      <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
        <RowButton>manage</RowButton>
        <RowButton>this month</RowButton>
        <RowButton glyph aria-label="Previous">
          ‹
        </RowButton>
        <RowButton glyph aria-label="Next">
          ›
        </RowButton>
        <RowButton glyph aria-label="Remove">
          ×
        </RowButton>
        <RowButton disabled>disabled</RowButton>
      </div>,
    );

    expect(v.container.querySelectorAll("button")).toHaveLength(6);
    await v.snapshot("row button variants");
  });
});
