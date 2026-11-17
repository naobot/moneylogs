import { describe, it, expect } from "vite-plus/test";
import Avatar from "@/components/Avatar";
import Button from "@/components/Button";
import ControlledInput from "@/components/ControlledInput";
import RowButton from "@/components/RowButton";
import Tabs from "@/components/Tabs";
import UpdateBanner from "@/components/UpdateBanner";
import { useVisualHarness } from "@/test/visual";

// One combined night-shift snapshot keeps the theme swap covered without doubling
// the snapshot count for every component.
describe("Night shift (visual)", () => {
  const v = useVisualHarness();

  it("renders the common primitives with swapped inks", async () => {
    v.night();
    const noop = () => {};
    v.render(
      <>
        <UpdateBanner onRefresh={noop} onDismiss={noop} />
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
          <Button text="primary" />
          <Button text="secondary" variant="secondary" />
          <Button text="selected" variant="toggle" isSelected />
          <RowButton>manage</RowButton>
        </div>
        <div>
          <Tabs
            tabs={[
              { id: "a", label: "posts" },
              { id: "b", label: "summary" },
            ]}
            activeId="a"
            onChange={noop}
          />
          <div className="Window" style={{ padding: "1rem" }}>
            <ControlledInput label="name" value="Kyoto trip" onChange={noop} />
            <ControlledInput
              label="email"
              value="x"
              onChange={noop}
              isError
              errorMessage="Invalid."
            />
          </div>
        </div>
        <div style={{ display: "flex", gap: "1rem" }}>
          <Avatar name="Momo" size={60} />
          <Avatar name="さくら" size={60} />
        </div>
      </>,
    );

    expect(document.documentElement.dataset.theme).toBe("night");
    await v.snapshot("night shift primitives");
  });
});
