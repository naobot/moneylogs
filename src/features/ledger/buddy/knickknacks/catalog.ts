import { ART } from "./art";
import { hemisphereOf, Season, seasonOf } from "./seasons";

/**
 * Things the budget buddy can stumble on. They have no use and aren't currency;
 * collecting them is the whole point. Which ones turn up depends on the season.
 */

export type KnickKnackId = keyof typeof ART;

/** Rare items turn up less often than the others in season (weights live server-side). */
export type Rarity = "common" | "rare";

export type KnickKnackInfo = {
  name: string;
  rarity: Rarity;
  /** Seasons it can be found in, in the finder's hemisphere. */
  seasons: readonly Season[];
  /** What the buddy says when it finds one. */
  found: string;
};

export const KNICK_KNACKS: Record<KnickKnackId, KnickKnackInfo> = {
  acorn: {
    name: "acorn",
    rarity: "common",
    seasons: ["autumn"],
    found: "ooh, an acorn! i'll keep it safe for a squirrel who never comes~",
  },
  pinecone: {
    name: "pinecone",
    rarity: "common",
    seasons: ["autumn", "winter"],
    found: "found a pinecone! it smells like a forest. *sniff sniff*",
  },
  apple: {
    name: "apple",
    rarity: "rare",
    seasons: ["autumn"],
    found: "an apple! there's a little worm living in it… hello, neighbour~",
  },
  maple_leaf: {
    name: "maple leaf",
    rarity: "common",
    seasons: ["autumn"],
    found: "a maple leaf drifted right onto the receipts. it's perfect!!",
  },
  pine_branch: {
    name: "pine branch",
    rarity: "common",
    seasons: ["winter"],
    found: "a little pine branch with snow still on it! it smells like the holidays~",
  },
  holly: {
    name: "holly",
    rarity: "common",
    seasons: ["winter"],
    found: "holly! careful, it's pointy. one of the berries is trying to escape…",
  },
  snowdrop: {
    name: "snowdrop",
    rarity: "rare",
    seasons: ["winter"],
    found: "a snowdrop poked up through the snow. so brave and so tiny ♡",
  },
  cherry_blossom: {
    name: "cherry blossom",
    rarity: "rare",
    seasons: ["spring"],
    found: "a cherry blossom! one petal already ran off on the breeze~",
  },
  tulip: {
    name: "tulip",
    rarity: "common",
    seasons: ["spring"],
    found: "a tulip, and it came with a ladybug! i promise not to pounce. probably.",
  },
  lilac: {
    name: "lilac",
    rarity: "common",
    seasons: ["spring"],
    found: "a sprig of lilac. it smells so sweet i might sneeze *achoo* ♡",
  },
  daisy: {
    name: "daisy",
    rarity: "common",
    seasons: ["summer"],
    found: "a daisy! loves me… loves me not… someone's been plucking it~",
  },
  sunflower: {
    name: "sunflower",
    rarity: "common",
    seasons: ["summer"],
    found: "a sunflower as big as my head! someone's been snacking on the seeds…",
  },
  dragonfly: {
    name: "dragonfly",
    rarity: "rare",
    seasons: ["summer"],
    found: "a dragonfly looped right past my nose and landed on the receipts ♪",
  },
};

export const KNICK_KNACK_IDS = Object.keys(KNICK_KNACKS) as KnickKnackId[];

/** The knick-knacks that can turn up in this month (1–12) for someone in this timezone. */
export const findableIn = ({
  month,
  timezone,
}: {
  month: number;
  timezone?: string | null;
}): KnickKnackId[] => {
  const season = seasonOf(month, hemisphereOf(timezone));
  return KNICK_KNACK_IDS.filter((id) => KNICK_KNACKS[id].seasons.includes(season));
};
