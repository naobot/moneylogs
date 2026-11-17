import { describe, it, expect } from "vite-plus/test";
import Button from "@/components/Button";
import { useVisualHarness } from "@/test/visual";

describe("Button (visual)", () => {
  const v = useVisualHarness();

  it("renders each style and state", async () => {
    v.render(
      <>
        <Button text="primary" />
        <Button text="bordered" buttonStyle="primary-border" />
        <Button text="lite" buttonStyle="primary-border-lite" />
        <Button text="selected" isSelected />
        <Button text="disabled" disabled />
        <Button text="small" size="sm" />
        <Button text="large" size="lg" />
      </>,
    );

    expect(v.container.querySelectorAll("button")).toHaveLength(7);
    await v.snapshot("button variants");
  });
});
