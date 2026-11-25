import { ART } from "./art";
import { hemisphereOf, Season, seasonOf } from "./seasons";

/**
 * Things the budget buddy can stumble on. They have no use and aren't currency;
 * collecting them is the whole point. Which ones turn up depends on the season.
 */

export type KnickKnackId = keyof typeof ART;

/**
 * Super-common items turn up most often and can be found all year; rare ones turn up
 * less often than the others in season (weights live server-side).
 * Milestone items are never found by chance: the buddy hands them over with an
 * achievement (functions/src/milestones.ts), and they can't be gifted. Special items
 * aren't found by chance either: they're granted by hand
 * (functions/scripts/grant-special.ts) or sent by the forest spirit
 * (functions/scripts/forest-gift.ts), and can be gifted like any find.
 */
export type Rarity = "super_common" | "common" | "rare" | "milestone" | "special";

/**
 * How each rarity reads in the UI. The ids stay as they are in data and in the
 * functions' weights: super-common reads "everyday", common "uncommon", milestone
 * "unique".
 */
export const RARITY_LABELS: Record<Rarity, string> = {
  super_common: "everyday",
  common: "uncommon",
  rare: "rare",
  milestone: "unique",
  special: "special",
};

export type KnickKnackInfo = {
  name: string;
  rarity: Rarity;
  /** Seasons it can be found in, in the finder's hemisphere. */
  seasons: readonly Season[];
  /** What the buddy says when it finds one. Sentence case (it's more than one sentence). */
  found: string;
  /**
   * Whether it comes from something done in a financial log (seasonal finds, coins). The
   * buddy in that log can reveal it; everything can be revealed from the drawer.
   */
  fromLog: boolean;
};

const ALL_SEASONS: readonly Season[] = ["spring", "summer", "autumn", "winter"];

export const KNICK_KNACKS: Record<KnickKnackId, KnickKnackInfo> = {
  acorn: {
    name: "acorn",
    rarity: "common",
    seasons: ["autumn"],
    found: "Ooh, an acorn! I'll keep it safe for a squirrel who never comes~",
    fromLog: true,
  },
  pinecone: {
    name: "pinecone",
    rarity: "common",
    seasons: ["autumn", "winter"],
    found: "Found a pinecone! It smells like a forest. *sniff sniff*",
    fromLog: true,
  },
  apple: {
    name: "apple",
    rarity: "rare",
    seasons: ["autumn"],
    found: "An apple! There's a little worm living in it… Hello, neighbour~",
    fromLog: true,
  },
  maple_leaf: {
    name: "maple leaf",
    rarity: "common",
    seasons: ["autumn"],
    found: "A maple leaf drifted right onto the receipts. It's perfect!!",
    fromLog: true,
  },
  persimmon: {
    name: "persimmon",
    rarity: "rare",
    seasons: ["autumn", "winter"],
    found: "A persimmon! It's so ripe it's practically glowing ♡",
    fromLog: true,
  },
  osmanthus: {
    name: "osmanthus",
    rarity: "common",
    seasons: ["autumn"],
    found: "A sprig of osmanthus. The whole room smells like apricots now~",
    fromLog: true,
  },
  chestnut: {
    name: "chestnut",
    rarity: "common",
    seasons: ["autumn"],
    found: "A chestnut came rolling past, so I pounced on it! All mine ♪",
    fromLog: true,
  },
  pine_branch: {
    name: "pine branch",
    rarity: "common",
    seasons: ["winter"],
    found: "A little pine branch with snow still on it! It smells like the holidays~",
    fromLog: true,
  },
  holly: {
    name: "holly",
    rarity: "common",
    seasons: ["winter"],
    found: "Holly! Careful, it's pointy. One of the berries is trying to escape…",
    fromLog: true,
  },
  snowdrop: {
    name: "snowdrop",
    rarity: "rare",
    seasons: ["winter"],
    found: "A snowdrop poked up through the snow. So brave and so tiny ♡",
    fromLog: true,
  },
  cherry_blossom: {
    name: "cherry blossom",
    rarity: "rare",
    seasons: ["spring"],
    found: "A cherry blossom! One petal already ran off on the breeze~",
    fromLog: true,
  },
  tulip: {
    name: "tulip",
    rarity: "common",
    seasons: ["spring"],
    found: "A tulip, and it came with a ladybug! I promise not to pounce. Probably.",
    fromLog: true,
  },
  lilac: {
    name: "lilac",
    rarity: "common",
    seasons: ["spring"],
    found: "A sprig of lilac. It smells so sweet I might sneeze *achoo* ♡",
    fromLog: true,
  },
  daisy: {
    name: "daisy",
    rarity: "common",
    seasons: ["summer"],
    found: "A daisy! Loves me… loves me not… Someone's been plucking it~",
    fromLog: true,
  },
  sunflower: {
    name: "sunflower",
    rarity: "common",
    seasons: ["summer"],
    found: "A sunflower as big as my head! Someone's been snacking on the seeds…",
    fromLog: true,
  },
  dragonfly: {
    name: "dragonfly",
    rarity: "rare",
    seasons: ["summer"],
    found: "A dragonfly looped right past my nose and landed on the receipts ♪",
    fromLog: true,
  },
  mushroom: {
    name: "mushroom",
    rarity: "super_common",
    seasons: ALL_SEASONS,
    found: "A little mushroom popped up overnight! I'm not eating it. *sniffs it a lot*",
    fromLog: true,
  },
  pebble: {
    name: "pebble",
    rarity: "super_common",
    seasons: ALL_SEASONS,
    found: "A perfectly smooth pebble! It fits right in my paw ♪ I'm keeping it forever~",
    fromLog: true,
  },
  feather: {
    name: "feather",
    rarity: "super_common",
    seasons: ALL_SEASONS,
    found: "A feather floated down from somewhere! I chased it for ages… worth it ♡",
    fromLog: true,
  },
  copper_coin: {
    name: "copper coin",
    rarity: "milestone",
    seasons: [],
    found: "A copper coin with a sprout growing out of it! Our very first~ I'll water it every day",
    fromLog: true,
  },
  silver_coin: {
    name: "silver coin",
    rarity: "milestone",
    seasons: [],
    found: "Ten days in a row!! Here, a silver coin. I polished it with my paw ♪",
    fromLog: true,
  },
  gold_coin: {
    name: "gold coin",
    rarity: "milestone",
    seasons: [],
    found: "A whole month!! A real gold coin. I only bit it a little, to check~",
    fromLog: true,
  },
  extra_shiny_gold_coin: {
    name: "extra shiny gold coin",
    rarity: "milestone",
    seasons: [],
    found: "One hundred days!!! The shiniest coin I've ever seen. *squints* ✦",
    fromLog: true,
  },
  heart_leaf: {
    name: "heart-shaped leaf",
    rarity: "milestone",
    seasons: [],
    found: "Your first entry with friends! I found a heart-shaped leaf to celebrate ♡",
    fromLog: false,
  },
  paper_crane: {
    name: "paper crane",
    rarity: "milestone",
    seasons: [],
    found: "A paper crane flew in with your first comment! I promise not to chase it… *wiggle*",
    fromLog: false,
  },
  friendship_bracelet: {
    name: "friendship bracelet",
    rarity: "milestone",
    seasons: [],
    found:
      "A friendship bracelet for your first friend! I made it myself. Well, mostly I tangled it~",
    fromLog: false,
  },
  little_envelope: {
    name: "little envelope",
    rarity: "milestone",
    seasons: [],
    found:
      "A little envelope from your first invite! Someone said yes~ I licked the seal myself *mlem*",
    fromLog: false,
  },
  shiny_gear: {
    name: "shiny gear",
    rarity: "milestone",
    seasons: [],
    found:
      "Found a shiny gear~ I think it's what keeps everything running. Thank you for helping fix it ♪",
    fromLog: false,
  },
  extra_shiny_gear: {
    name: "extra shiny gear",
    rarity: "milestone",
    seasons: [],
    found:
      "An extra shiny gear!! Fourteen days in a row, you kept every wheel turning ♪ Thank you~",
    fromLog: false,
  },
  mini_robot_charm: {
    name: "mini robot charm",
    rarity: "special",
    seasons: [],
    found: "A little robot charm! It winked at me. I think we're friends now ♪",
    fromLog: false,
  },
  enoki_bunch: {
    name: "enoki bunch",
    rarity: "special",
    seasons: [],
    found: "A bunch of enoki, tied with a bow! One of them fell asleep on the others~ *tiptoe*",
    fromLog: false,
  },
  olive_branch: {
    name: "olive branch",
    rarity: "special",
    seasons: [],
    found:
      "An olive branch! I think it means peace… or snacks? One olive already rolled away *pounce*",
    fromLog: false,
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
