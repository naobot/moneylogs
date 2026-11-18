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

export type KnickKnackInfo = {
  name: string;
  rarity: Rarity;
  /** Seasons it can be found in, in the finder's hemisphere. */
  seasons: readonly Season[];
  /** What the buddy says when it finds one. */
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
    found: "ooh, an acorn! i'll keep it safe for a squirrel who never comes~",
    fromLog: true,
  },
  pinecone: {
    name: "pinecone",
    rarity: "common",
    seasons: ["autumn", "winter"],
    found: "found a pinecone! it smells like a forest. *sniff sniff*",
    fromLog: true,
  },
  apple: {
    name: "apple",
    rarity: "rare",
    seasons: ["autumn"],
    found: "an apple! there's a little worm living in it… hello, neighbour~",
    fromLog: true,
  },
  maple_leaf: {
    name: "maple leaf",
    rarity: "common",
    seasons: ["autumn"],
    found: "a maple leaf drifted right onto the receipts. it's perfect!!",
    fromLog: true,
  },
  persimmon: {
    name: "persimmon",
    rarity: "rare",
    seasons: ["autumn", "winter"],
    found: "a persimmon! it's so ripe it's practically glowing ♡",
    fromLog: true,
  },
  osmanthus: {
    name: "osmanthus",
    rarity: "common",
    seasons: ["autumn"],
    found: "a sprig of osmanthus. the whole room smells like apricots now~",
    fromLog: true,
  },
  chestnut: {
    name: "chestnut",
    rarity: "common",
    seasons: ["autumn"],
    found: "a chestnut came rolling past, so i pounced on it! all mine ♪",
    fromLog: true,
  },
  pine_branch: {
    name: "pine branch",
    rarity: "common",
    seasons: ["winter"],
    found: "a little pine branch with snow still on it! it smells like the holidays~",
    fromLog: true,
  },
  holly: {
    name: "holly",
    rarity: "common",
    seasons: ["winter"],
    found: "holly! careful, it's pointy. one of the berries is trying to escape…",
    fromLog: true,
  },
  snowdrop: {
    name: "snowdrop",
    rarity: "rare",
    seasons: ["winter"],
    found: "a snowdrop poked up through the snow. so brave and so tiny ♡",
    fromLog: true,
  },
  cherry_blossom: {
    name: "cherry blossom",
    rarity: "rare",
    seasons: ["spring"],
    found: "a cherry blossom! one petal already ran off on the breeze~",
    fromLog: true,
  },
  tulip: {
    name: "tulip",
    rarity: "common",
    seasons: ["spring"],
    found: "a tulip, and it came with a ladybug! i promise not to pounce. probably.",
    fromLog: true,
  },
  lilac: {
    name: "lilac",
    rarity: "common",
    seasons: ["spring"],
    found: "a sprig of lilac. it smells so sweet i might sneeze *achoo* ♡",
    fromLog: true,
  },
  daisy: {
    name: "daisy",
    rarity: "common",
    seasons: ["summer"],
    found: "a daisy! loves me… loves me not… someone's been plucking it~",
    fromLog: true,
  },
  sunflower: {
    name: "sunflower",
    rarity: "common",
    seasons: ["summer"],
    found: "a sunflower as big as my head! someone's been snacking on the seeds…",
    fromLog: true,
  },
  dragonfly: {
    name: "dragonfly",
    rarity: "rare",
    seasons: ["summer"],
    found: "a dragonfly looped right past my nose and landed on the receipts ♪",
    fromLog: true,
  },
  mushroom: {
    name: "mushroom",
    rarity: "super_common",
    seasons: ALL_SEASONS,
    found: "a little mushroom popped up overnight! i'm not eating it. *sniffs it a lot*",
    fromLog: true,
  },
  pebble: {
    name: "pebble",
    rarity: "super_common",
    seasons: ALL_SEASONS,
    found: "a perfectly smooth pebble! it fits right in my paw ♪ i'm keeping it forever~",
    fromLog: true,
  },
  feather: {
    name: "feather",
    rarity: "super_common",
    seasons: ALL_SEASONS,
    found: "a feather floated down from somewhere! i chased it for ages… worth it ♡",
    fromLog: true,
  },
  copper_coin: {
    name: "copper coin",
    rarity: "milestone",
    seasons: [],
    found: "a copper coin with a sprout growing out of it! our very first~ i'll water it every day",
    fromLog: true,
  },
  silver_coin: {
    name: "silver coin",
    rarity: "milestone",
    seasons: [],
    found: "ten days in a row!! here, a silver coin. i polished it with my paw ♪",
    fromLog: true,
  },
  gold_coin: {
    name: "gold coin",
    rarity: "milestone",
    seasons: [],
    found: "a whole month!! a real gold coin. i only bit it a little, to check~",
    fromLog: true,
  },
  extra_shiny_gold_coin: {
    name: "extra shiny gold coin",
    rarity: "milestone",
    seasons: [],
    found: "one hundred days!!! the shiniest coin i've ever seen. *squints* ✦",
    fromLog: true,
  },
  heart_leaf: {
    name: "heart-shaped leaf",
    rarity: "milestone",
    seasons: [],
    found: "your first entry with friends! i found a heart-shaped leaf to celebrate ♡",
    fromLog: false,
  },
  paper_crane: {
    name: "paper crane",
    rarity: "milestone",
    seasons: [],
    found: "a paper crane flew in with your first comment! i promise not to chase it… *wiggle*",
    fromLog: false,
  },
  friendship_bracelet: {
    name: "friendship bracelet",
    rarity: "milestone",
    seasons: [],
    found:
      "a friendship bracelet for your first friend! i made it myself. well, mostly i tangled it~",
    fromLog: false,
  },
  little_envelope: {
    name: "little envelope",
    rarity: "milestone",
    seasons: [],
    found:
      "a little envelope from your first invite! someone said yes~ i licked the seal myself *mlem*",
    fromLog: false,
  },
  mini_robot_charm: {
    name: "mini robot charm",
    rarity: "special",
    seasons: [],
    found: "a little robot charm! it winked at me. i think we're friends now ♪",
    fromLog: false,
  },
  enoki_bunch: {
    name: "enoki bunch",
    rarity: "special",
    seasons: [],
    found: "a bunch of enoki, tied with a bow! one of them fell asleep on the others~ *tiptoe*",
    fromLog: false,
  },
  olive_branch: {
    name: "olive branch",
    rarity: "special",
    seasons: [],
    found:
      "an olive branch! i think it means peace… or snacks? one olive already rolled away *pounce*",
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
