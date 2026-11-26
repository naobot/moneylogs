import { describe, it, expect } from "vite-plus/test";
import { useVisualHarness } from "@/test/visual";
import { ART } from "@/features/ledger/buddy/knickknacks/art";
import { PRESET_AVATARS } from "@/features/account/avatar/presets";
import { CardFormat, CardSpec, renderCard } from "../renderCard";

const daily: CardSpec = {
  heading: "today",
  date: "sat 21 nov",
  name: "Alice",
  location: "Kyoto",
  face: "ฅ(=✧ω✧=)ฅ",
  lines: ["I spent 3× less than on a usual Saturday!", "4 no-spend days in a row!"],
  pieTitle: "where my money went",
  slices: [
    { id: "groceries", name: "Groceries", share: 0.45 },
    { id: "eating", name: "Eating out", share: 0.35 },
    { id: "transit", name: "Transit", share: 0.2 },
  ],
  showNames: true,
  avatar: PRESET_AVATARS[0].grid,
  knickKnack: { grid: ART.pebble },
};

const breakdown: CardSpec = {
  ...daily,
  heading: "november",
  date: "nov 2026",
  lines: [],
  slices: ["Groceries", "Eating out", "Transit", "Gifts", "Books", "other"].map((name, i) => ({
    id: name,
    name,
    share: [0.3, 0.25, 0.15, 0.12, 0.1, 0.08][i],
  })),
};

/** A stand-in photo: a two-tone gradient with a disc, so crops and framing show. */
const fakePhoto = (width: number, height: number, hue: number) => {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d")!;
  const fill = ctx.createLinearGradient(0, 0, width, height);
  fill.addColorStop(0, `hsl(${hue}, 50%, 65%)`);
  fill.addColorStop(1, `hsl(${hue + 60}, 40%, 30%)`);
  ctx.fillStyle = fill;
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = "white";
  ctx.beginPath();
  ctx.arc(width / 2, height / 2, Math.min(width, height) / 4, 0, 2 * Math.PI);
  ctx.fill();
  return canvas;
};

const PHOTO_SIZES: [number, number][] = [
  [1008, 756],
  [540, 960],
  [600, 600],
];
const photoSources = PHOTO_SIZES.map(([w, h], i) => fakePhoto(w, h, i * 90));

/** The daily card with three photos and amounts shown. */
const withPhotos: CardSpec = {
  ...daily,
  lines: [...daily.lines, "15% less than this point last month"],
  slices: breakdown.slices.map((sl) => ({
    ...sl,
    amountLabel: `${Math.round(sl.share * 10000).toLocaleString("en-US")} JPY`,
  })),
  total: "10,000 JPY",
  photos: PHOTO_SIZES.map(([width, height], i) => ({ id: `p${i}`, width, height })),
};

/** Render cards to PNGs and show them as images (scaled down), waiting for each to load. */
const showCards = async (
  v: ReturnType<typeof useVisualHarness>,
  cards: ReadonlyArray<[CardSpec, CardFormat]>,
) => {
  const urls = await Promise.all(
    cards.map(async ([spec, format]) =>
      URL.createObjectURL(
        await renderCard(spec, format, undefined, spec.photos?.length ? photoSources : []),
      ),
    ),
  );
  v.render(
    <div style={{ display: "flex", gap: "1rem", alignItems: "flex-start" }}>
      {urls.map((url) => (
        <img key={url} src={url} width={270} alt="" />
      ))}
    </div>,
  );
  await Promise.all(
    Array.from(v.container.querySelectorAll("img")).map((img) =>
      img.complete ? Promise.resolve() : new Promise((resolve) => (img.onload = resolve)),
    ),
  );
  return v.container.querySelectorAll("img");
};

describe("share cards (visual)", () => {
  const v = useVisualHarness();

  it("renders the daily summary and breakdown in both formats", async () => {
    const imgs = await showCards(v, [
      [daily, "story"],
      [daily, "square"],
      [breakdown, "story"],
      [breakdown, "square"],
    ]);
    expect(imgs).toHaveLength(4);
    expect(imgs[0].naturalHeight).toBe(1920);
    expect(imgs[1].naturalHeight).toBe(1080);
    await v.snapshot("share cards", { phoneRules: false });
  });

  it("makes room for photos, and shows amounts when asked", async () => {
    const imgs = await showCards(v, [
      [withPhotos, "story"],
      [withPhotos, "square"],
      [{ ...withPhotos, photos: withPhotos.photos!.slice(0, 1) }, "story"],
    ]);
    expect(imgs).toHaveLength(3);
    await v.snapshot("share cards with photos and amounts", { phoneRules: false });
  });

  it("follows night shift", async () => {
    v.night();
    await showCards(v, [[daily, "square"]]);
    await v.snapshot("share card night shift", { phoneRules: false });
  });
});
