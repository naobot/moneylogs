import { ART } from "./art";
import { hemisphereOf, Season, seasonOf } from "./seasons";

/**
 * Things the budget buddy can stumble on. They have no use and aren't currency;
 * collecting them is the whole point. Which ones turn up depends on the season.
 */

export type KnickKnackId = keyof typeof ART;

export type KnickKnackInfo = {
  name: string;
  /** Seasons it can be found in, in the finder's hemisphere. */
  seasons: readonly Season[];
  /** What the buddy says when it finds one. */
  found: string;
};

export const KNICK_KNACKS: Record<KnickKnackId, KnickKnackInfo> = {
  acorn: {
    name: "acorn",
    seasons: ["autumn"],
    found: "ooh, an acorn! i'll keep it safe for a squirrel who never comes~",
  },
  pinecone: {
    name: "pinecone",
    seasons: ["autumn", "winter"],
    found: "found a pinecone! it smells like a forest. *sniff sniff*",
  },
  maple_leaf: {
    name: "maple leaf",
    seasons: ["autumn"],
    found: "a maple leaf drifted right onto the receipts. it's perfect!!",
  },
  pine_branch: {
    name: "pine branch",
    seasons: ["winter"],
    found: "a little pine branch with snow still on it! it smells like the holidays~",
  },
  holly: {
    name: "holly",
    seasons: ["winter"],
    found: "holly! careful, it's pointy. one of the berries is trying to escape…",
  },
  snowdrop: {
    name: "snowdrop",
    seasons: ["winter"],
    found: "a snowdrop poked up through the snow. so brave and so tiny ♡",
  },
  cherry_blossom: {
    name: "cherry blossom",
    seasons: ["spring"],
    found: "a cherry blossom! one petal already ran off on the breeze~",
  },
  tulip: {
    name: "tulip",
    seasons: ["spring"],
    found: "a tulip, and it came with a ladybug! i promise not to pounce. probably.",
  },
  lilac: {
    name: "lilac",
    seasons: ["spring"],
    found: "a sprig of lilac. it smells so sweet i might sneeze *achoo* ♡",
  },
  daisy: {
    name: "daisy",
    seasons: ["summer"],
    found: "a daisy! loves me… loves me not… someone's been plucking it~",
  },
  sunflower: {
    name: "sunflower",
    seasons: ["summer"],
    found: "a sunflower as big as my head! someone's been snacking on the seeds…",
  },
  dragonfly: {
    name: "dragonfly",
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
