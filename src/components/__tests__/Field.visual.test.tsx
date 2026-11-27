import { describe, it, expect } from "vite-plus/test";
import { act } from "react";
import Field from "@/components/Field";
import TextArea from "@/components/TextArea";
import Select, { InlineSelect } from "@/components/Select";
import Amount from "@/components/Amount";
import { useVisualHarness } from "@/test/visual";

const noop = () => {};
const CATEGORIES = [
  { value: "groceries", label: "groceries" },
  { value: "dining", label: "dining out" },
];

/** Every input state from the Inputs board (C7–C10). */
const Inputs = () => (
  <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
    <Field label="log name" placeholder="e.g. tokyo flat" value="" onChange={noop} />
    <Field label="log name" value="household" onChange={noop} data-focus="field" />
    <Field label="log name" value="" onChange={noop} error="give the log a name" />
    <Field label="log name" value="locked after archive" onChange={noop} disabled />
    <Field label="starts" type="date" value="2026-11-26" onChange={noop} hint="in your timezone" />

    <TextArea
      label="post"
      placeholder="what happened today?"
      value=""
      onChange={noop}
      markdown
      maxLength={2000}
    />
    <TextArea
      label="comment"
      value={
        "found the good bakery by the station.\nsplit the taxi home.\nrain all day.\nbought an umbrella at the konbini.\nworth it."
      }
      onChange={noop}
      markdown
      maxLength={120}
      counter="near-limit"
    />

    <Select label="category" value="groceries" onChange={noop} options={CATEGORIES} />
    <Select
      label="category"
      value="groceries"
      onChange={noop}
      options={CATEGORIES}
      data-focus="select"
    />
    <Select
      label="category"
      value=""
      onChange={noop}
      options={CATEGORIES}
      placeholder="pick a category…"
    />

    <Amount label="amount" value="2,180" onChange={noop} currency="JPY" onCurrencyChange={noop} />
    <Amount label="amount" value="" onChange={noop} currency="CAD" error="enter an amount" />

    <div style={{ display: "flex", gap: 14 }}>
      <InlineSelect
        aria-label="Currency"
        value="JPY"
        onChange={noop}
        options={[{ value: "JPY", label: "JPY" }]}
      />
      <InlineSelect
        aria-label="Period"
        value="month"
        onChange={noop}
        options={[{ value: "month", label: "this month" }]}
      />
    </div>
  </div>
);

describe("Field, TextArea, Select, Amount (visual)", () => {
  const v = useVisualHarness();

  const focusMarked = () =>
    act(() => {
      // One focused field and one focused select, so their 2px states are in the shot.
      v.container.querySelector<HTMLElement>("[data-focus='field']")!.focus();
    });

  it("draws every input state", async () => {
    v.render(<Inputs />);
    focusMarked();
    expect(v.container.querySelectorAll(".Field")).toHaveLength(12);
    await v.sizes("inputs");
  });

  it("shows a focused select's inverted ▴ cell", async () => {
    v.render(<Inputs />);
    act(() => v.container.querySelector<HTMLElement>("[data-focus='select']")!.focus());
    const cell = v.container
      .querySelector("[data-focus='select']")!
      .parentElement!.querySelector(".Select__cell")!;
    expect(getComputedStyle(cell, "::before").content).toBe('"▴"');
    await v.snapshot("inputs · select focused");
  });

  it("grows a text area from 3 to 8 lines, then scrolls", async () => {
    v.render(<Inputs />);
    const [empty, full] = Array.from(v.container.querySelectorAll<HTMLTextAreaElement>("textarea"));
    const line = parseFloat(getComputedStyle(empty).lineHeight);
    expect(empty.getBoundingClientRect().height).toBeGreaterThanOrEqual(3 * line);
    expect(empty.getBoundingClientRect().height).toBeLessThan(4 * line);
    // Five lines fit under the cap: all of them show, nothing scrolls.
    expect(full.getBoundingClientRect().height).toBeGreaterThanOrEqual(5 * line);
    expect(full.getBoundingClientRect().height).toBeLessThanOrEqual(8 * line + 24);
    expect(full.scrollHeight).toBeLessThanOrEqual(full.clientHeight + 1);
  });

  it("scrolls a text area past 8 lines", async () => {
    v.render(
      <TextArea
        label="post"
        value={Array.from({ length: 14 }, (_, i) => `line ${i}`).join("\n")}
        onChange={noop}
      />,
    );
    const area = v.container.querySelector<HTMLTextAreaElement>("textarea")!;
    const line = parseFloat(getComputedStyle(area).lineHeight);
    expect(area.getBoundingClientRect().height).toBeLessThanOrEqual(8 * line + 24);
    expect(area.scrollHeight).toBeGreaterThan(area.clientHeight);
    expect(getComputedStyle(area).overflowY).toBe("auto");
  });

  it("themes them in night shift", async () => {
    v.night();
    v.render(<Inputs />);
    await v.snapshot("inputs · night");
  });
});
