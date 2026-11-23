import { describe, it, expect } from "vite-plus/test";
import UpdateBanner from "@/components/UpdateBanner";
import { useVisualHarness } from "@/test/visual";

describe("UpdateBanner (visual)", () => {
  const v = useVisualHarness();

  it("renders the update prompt", async () => {
    v.render(<UpdateBanner onRefresh={() => {}} onDismiss={() => {}} />);

    expect(v.container.querySelector("[role=alert]")).not.toBeNull();
    await v.snapshot("update banner");
  });
});
