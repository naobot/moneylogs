import { describe, it, expect } from "vite-plus/test";
import Button from "@/components/Button";
import RowButton from "@/components/RowButton";
import { PHONE, TYPE_FLOOR_PX, useVisualHarness } from "@/test/visual";

const LADDER = ["display", "heading", "body", "small", "caption", "micro"] as const;
const GAPS = ["inside", "between", "group", "section"] as const;

const label = { fontSize: "var(--phone-caption)", color: "var(--ink-muted)" };

/** The 2026-11 foundations tokens (src/tokens.scss), drawn so a change to one shows. */
const TokensScene = () => (
  <div className="TokensScene" style={{ display: "flex", flexDirection: "column", gap: 28 }}>
    {/* Outlines each grown hit area, which is invisible in the app. */}
    <style>{`.TokensScene .Button::after, .TokensScene .RowButton::after {
      outline: 1px dashed var(--ink-faint);
    }`}</style>

    <section>
      <div style={label}>phone ladder</div>
      {LADDER.map((step) => (
        <div key={step} style={{ fontSize: `var(--phone-${step})`, lineHeight: 1.3 }}>
          {step} ¥ 48,210
        </div>
      ))}
    </section>

    <section>
      <div style={label}>rhythm</div>
      {GAPS.map((gap) => (
        <div key={gap} style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span
            data-gap={gap}
            style={{ width: `var(--gap-${gap})`, height: 12, background: "var(--ink)" }}
          />
          <span style={{ fontSize: "var(--phone-caption)" }}>{gap}</span>
        </div>
      ))}
    </section>

    <section style={{ display: "flex", flexDirection: "column", alignItems: "flex-start" }}>
      <div style={label}>tap targets</div>
      <div style={{ display: "flex", gap: 48, padding: "16px 12px" }}>
        <Button text="Add" variant="secondary" size="sm" />
        <RowButton>edit</RowButton>
      </div>
    </section>

    <section>
      <div style={label}>shadow-float</div>
      <div
        style={{
          width: 160,
          padding: "8px 12px",
          background: "var(--paper)",
          border: "var(--border-rule) solid var(--ink)",
          boxShadow: "var(--shadow-float)",
        }}
      >
        a floating menu
      </div>
    </section>
  </div>
);

describe("Foundation tokens (visual)", () => {
  const v = useVisualHarness();

  it("draws the phone ladder, rhythm, tap targets and the float shadow", async () => {
    v.render(<TokensScene />);
    await v.sizes("tokens");
  });

  it("gives shared controls a 44px hit area on phones at every UI size", async () => {
    v.render(<TokensScene />);
    await v.viewport(PHONE);
    for (const size of ["s", "m", "l"] as const) {
      v.uiSize(size);
      for (const el of v.container.querySelectorAll(".Button, .RowButton")) {
        const after = getComputedStyle(el, "::after");
        expect(parseFloat(after.width)).toBeGreaterThanOrEqual(44);
        expect(parseFloat(after.height)).toBeGreaterThanOrEqual(44);
      }
    }
    // Wider screens are pointer-first: nothing grows.
    await v.viewport({ width: 1024, height: 768 });
    for (const el of v.container.querySelectorAll(".Button, .RowButton")) {
      expect(getComputedStyle(el, "::after").content).toBe("none");
    }
  });

  it("keeps the micro step at the type floor and the outer gaps fixed at UI size S", async () => {
    v.render(<TokensScene />);
    v.uiSize("s");
    const micro = v.container.querySelector<HTMLElement>("[style*='--phone-micro']")!;
    expect(parseFloat(getComputedStyle(micro).fontSize)).toBe(TYPE_FLOOR_PX);
    const width = (gap: string) =>
      v.container.querySelector(`[data-gap="${gap}"]`)!.getBoundingClientRect().width;
    expect(width("group")).toBe(18);
    expect(width("section")).toBe(28);
    expect(width("inside")).toBeLessThan(4);
  });
});
