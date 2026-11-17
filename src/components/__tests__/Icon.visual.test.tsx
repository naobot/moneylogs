import { describe, it, expect } from "vite-plus/test";
import Icon, { IconText, IconType } from "@/components/Icon";
import { useVisualHarness } from "@/test/visual";

const ALL_ICONS: IconType[] = [
  "home",
  "question",
  "warning",
  "notification",
  "clock",
  "exit",
  "location",
  "dollar",
  "document",
  "user",
  "speech",
  "plus",
  "trash",
  "pencil",
  "speech-filled",
  "calculator",
  "pin",
  "gear",
  "sun",
  "moon",
  "smiley",
  "social",
  "bell",
  "folder",
  "wallet",
  "gift",
];

/** Snapshots must wait for every <img> icon to load, or they capture empty boxes. */
const iconsLoaded = (root: HTMLElement) =>
  Promise.all(
    Array.from(root.querySelectorAll("img")).map((img) =>
      img.complete ? Promise.resolve() : new Promise((done) => (img.onload = img.onerror = done)),
    ),
  );

describe("Icon (visual)", () => {
  const v = useVisualHarness();

  it("renders the full icon set, inverted icons and icon text", async () => {
    v.render(
      <>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem" }}>
          {ALL_ICONS.map((type) => (
            <Icon key={type} type={type} />
          ))}
        </div>
        <div style={{ display: "flex", gap: "0.75rem" }}>
          <div style={{ background: "var(--inverse-surface)", padding: "0.5rem" }}>
            <Icon type="home" fill="white" />
          </div>
          <div style={{ background: "var(--inverse-surface)", padding: "0.5rem" }}>
            <Icon type="bell" fill="white" />
          </div>
        </div>
        <IconText type="location" text="Kyoto, Japan" />
        <IconText type="clock" text="3 days left" size={16} />
      </>,
    );

    await iconsLoaded(v.container);
    expect(v.container.querySelectorAll("img")).toHaveLength(ALL_ICONS.length + 4);
    await v.snapshot("icon set");
  });
});
