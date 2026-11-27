import { describe, it, expect, vi } from "vite-plus/test";
import { act, useState } from "react";
import Switch from "@/components/Switch";
import Check, { RadioRows } from "@/components/Check";
import { useVisualHarness } from "@/test/visual";

const noop = () => {};

const SAVING = [
  {
    id: "lot",
    label: "save a lot",
    description: "Tight budgets: about 30% under what you spent last month.",
  },
  {
    id: "steady",
    label: "save steadily",
    description: "A little under last month, every month.",
  },
  { id: "track", label: "just keep track", description: "Budgets at what you spend now." },
] as const;

/** The controls of a settings page and a wizard step, in each state. */
const Controls = () => (
  <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
    <div>
      <Switch label="colour charts" checked onChange={noop} />
      <Switch
        label="daily digest"
        hint="One email in the morning, only when something happened."
        checked={false}
        onChange={noop}
      />
      <Switch
        label="fixed cost"
        hint="Ask the person who made the log."
        checked
        disabled
        onChange={noop}
      />
    </div>

    <div>
      <Check checked={false} onChange={noop}>
        12 nov · coffee
      </Check>
      <Check checked onChange={noop}>
        15 nov · groceries for the flat, and a very long note that has to wrap
      </Check>
      <Check checked={false} disabled onChange={noop}>
        already imported
      </Check>
    </div>

    <RadioRows
      name="saving"
      aria-label="How hard do you want to save?"
      options={SAVING}
      value="steady"
      onChange={noop}
    />
  </div>
);

describe("Switch + Check + RadioRows (visual)", () => {
  const v = useVisualHarness();

  it("draws switches, checkboxes and radio rows in each state", async () => {
    v.render(<Controls />);
    expect(v.container.querySelectorAll("[role=switch]")).toHaveLength(3);
    await v.sizes("switch and check");
  });

  it("themes them in night shift", async () => {
    v.night();
    v.render(<Controls />);
    await v.snapshot("switch and check · night");
  });

  it("toggles a switch from anywhere on its row, once", async () => {
    const onChange = vi.fn();
    const Live = () => {
      const [on, setOn] = useState(false);
      return (
        <Switch
          label="colour charts"
          checked={on}
          onChange={(next) => {
            onChange(next);
            setOn(next);
          }}
        />
      );
    };
    v.render(<Live />);
    const label = v.container.querySelector<HTMLElement>(".Switch__label")!;
    act(() => label.click());
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenLastCalledWith(true);
    const track = v.container.querySelector<HTMLElement>("[role=switch]")!;
    act(() => track.click());
    expect(onChange).toHaveBeenCalledTimes(2);
    expect(track).toHaveAttribute("aria-checked", "false");
  });

  it("checks a row and picks a radio from its text", async () => {
    const onCheck = vi.fn();
    const onPick = vi.fn();
    v.render(
      <>
        <Check checked={false} onChange={onCheck}>
          coffee
        </Check>
        <RadioRows name="s" aria-label="Saving" options={SAVING} value="steady" onChange={onPick} />
      </>,
    );
    act(() => v.container.querySelector<HTMLElement>(".Check__label")!.click());
    expect(onCheck).toHaveBeenCalledWith(true);
    const lot = Array.from(v.container.querySelectorAll<HTMLElement>(".RadioRows__label")).find(
      (el) => el.textContent === "save a lot",
    )!;
    act(() => lot.click());
    expect(onPick).toHaveBeenCalledWith("lot");
  });
});
