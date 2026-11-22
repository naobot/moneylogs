import { describe, it, expect } from "vite-plus/test";
import UpdateRequired from "../UpdateRequired";
import { useVisualHarness } from "@/test/visual";

describe("UpdateRequired (visual)", () => {
  const v = useVisualHarness();

  it("renders the update stop with a store button", async () => {
    v.render(<UpdateRequired storeUrl="https://example.com/store" />);

    expect(v.container.querySelector(".UpdateRequired button")).not.toBeNull();
    await v.snapshot("with store link");
  });

  it("renders the update stop without a store link", async () => {
    v.render(<UpdateRequired />);

    expect(v.container.querySelector(".UpdateRequired button")).toBeNull();
    await v.snapshot("without store link");
  });
});
