import { describe, it, expect } from "vite-plus/test";
import { MemoryRouter } from "react-router-dom";
import Drawer from "@/components/Drawer";
import { useVisualHarness } from "@/test/visual";

describe("Drawer (visual)", () => {
  const v = useVisualHarness();

  it("renders closed and open drawers", async () => {
    v.render(
      <MemoryRouter initialEntries={["/me"]}>
        <Drawer id="visual-closed" title="achievements" summary="3 unlocked">
          hidden body
        </Drawer>
        <Drawer id="visual-open" title="display" defaultOpen>
          <p>Night shift, date format and currency settings live here.</p>
        </Drawer>
        <Drawer id="visual-no-summary" title="danger zone">
          hidden body
        </Drawer>
      </MemoryRouter>,
    );

    expect(v.container.querySelectorAll("details[open]")).toHaveLength(1);
    await v.snapshot("drawers closed and open");
  });
});
