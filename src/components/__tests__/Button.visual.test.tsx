import { describe, it, expect } from "vite-plus/test";
import Button from "@/components/Button";
import { useVisualHarness } from "@/test/visual";

describe("Button (visual)", () => {
  const v = useVisualHarness();

  it("renders each variant and state", async () => {
    v.render(
      <>
        <Button text="primary" />
        <Button text="secondary" variant="secondary" />
        <Button text="toggle" variant="toggle" />
        <Button text="selected" variant="toggle" isSelected />
        <Button title="icon" variant="icon" icon="home" />
        <Button text="disabled" disabled />
        <Button text="small" size="sm" />
      </>,
    );

    expect(v.container.querySelectorAll("button")).toHaveLength(7);
    await v.snapshot("button variants");
  });
});
