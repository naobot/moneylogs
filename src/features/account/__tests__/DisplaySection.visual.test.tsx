import { describe, it, expect } from "vite-plus/test";
import { MemoryRouter } from "react-router-dom";
import { DisplaySection } from "../DisplaySection";
import { initDisplayPrefs } from "@/utils/displayPrefs";
import { initTheme } from "@/utils/theme";
import { useVisualHarness } from "@/test/visual";

// The /me Display drawer at every text and UI size, with its own text size and UI size
// rows showing the pair it's drawn at.
describe("DisplaySection (visual)", () => {
  const v = useVisualHarness();

  it("renders the drawer at every text and UI size", async () => {
    initTheme();
    initDisplayPrefs();
    v.render(
      <MemoryRouter>
        <DisplaySection />
      </MemoryRouter>,
    );

    expect(v.container.querySelector('[aria-label="Text size"]')).not.toBeNull();
    expect(v.container.querySelector('[aria-label="UI size"]')).not.toBeNull();
    await v.sizes("display drawer");
  });
});
