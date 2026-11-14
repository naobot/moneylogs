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
