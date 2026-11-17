import { describe, it, expect } from "vite-plus/test";
import Avatar from "@/components/Avatar";
import { useVisualHarness } from "@/test/visual";

// A 30×30 smiley: frame, two eyes and a mouth.
const SMILEY = Array.from({ length: 30 }, (_, y) =>
  Array.from({ length: 30 }, (_, x) => {
    if (x === 0 || y === 0 || x === 29 || y === 29) return "#";
    if ((x >= 9 && x <= 11 && y >= 9 && y <= 12) || (x >= 18 && x <= 20 && y >= 9 && y <= 12))
      return "#";
    if (y === 20 && x >= 8 && x <= 21) return "#";
    if (y === 19 && (x === 7 || x === 22)) return "#";
    return ".";
  }).join(""),
);

describe("Avatar (visual)", () => {
  const v = useVisualHarness();

  it("renders drawn avatars and fallbacks at each size", async () => {
    v.render(
      <>
        {([15, 30, 60] as const).map((size) => (
          <div key={size} style={{ display: "flex", gap: "1rem", alignItems: "center" }}>
            <Avatar avatar={SMILEY} name="Momo" size={size} />
            <Avatar name="Élodie" size={size} />
            <Avatar name="さくら" size={size} />
            <Avatar size={size} />
          </div>
        ))}
      </>,
    );

    expect(v.container.querySelectorAll("[role=img]")).toHaveLength(12);
    await v.snapshot("avatar sizes and fallbacks");
  });
});
