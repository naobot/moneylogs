import { describe, it, expect, vi } from "vite-plus/test";
import { act } from "react";
import { MemoryRouter } from "react-router-dom";
import { initDisplayPrefs } from "@/utils/displayPrefs";
import { initTheme } from "@/utils/theme";
import { useVisualHarness } from "@/test/visual";

vi.mock("@/features/auth/hooks/useSignOut", () => ({
  useSignOut: () => ({ signOut: () => {}, isPending: false }),
}));

import { NavMenu } from "../NavMenu";

// The quick display settings the nav menu's eye opens, at every text and UI size: its own
// rows show the pair it's drawn at, so the picked option and the room around it change.
describe("NavMenu (visual)", () => {
  const v = useVisualHarness();

  it("renders quick display at every text and UI size", async () => {
    initTheme();
    initDisplayPrefs();
    v.render(
      <MemoryRouter>
        <NavMenu isLoggedIn />
      </MemoryRouter>,
    );
    act(() => v.container.querySelector<HTMLButtonElement>(".NavMenu__trigger")!.click());
    const display = Array.from(document.querySelectorAll<HTMLButtonElement>("[role=menuitem]"))[0];
    act(() => display.click());

    expect(document.querySelector("#modal-root .QuickDisplay")).not.toBeNull();
    await v.sizes("quick display");
  });
});
