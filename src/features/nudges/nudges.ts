import type { Timestamp } from "firebase/firestore";

import { cheerText } from "./cheers";

/**
 * A friend's pokes and latest cheer waiting for you. One doc per sender → recipient at
 * `nudges/{from}__{to}`: more pokes add to `pokes`, a new cheer replaces the old one,
 * and reading it deletes it, so nothing piles up and no history is kept. Unread ones
 * expire on their own (a TTL policy on `expireAt`).
 */
export type Nudge = {
  id: string;
  from: string;
  to: string;
  fromUid: string;
  toUid: string;
  pokes: number;
  cheer: string | null;
  at: Timestamp | null;
  expireAt: Timestamp;
};

/** How long an unread nudge waits before the TTL policy clears it. */
export const NUDGE_TTL_DAYS = 14;

/** Pokes accepted in one write (the rules allow the same). */
export const MAX_POKES_PER_WRITE = 50;

/** The doc id for nudges from one user to another (direction matters). */
export const nudgeId = (from: string, to: string): string => `${from}__${to}`;

/** What a nudge says, e.g. "poked you ×3 · you've got this". */
export const nudgeSummary = (nudge: Pick<Nudge, "pokes" | "cheer">): string => {
  const parts: string[] = [];
  if (nudge.pokes > 0) parts.push(nudge.pokes > 1 ? `poked you ×${nudge.pokes}` : "poked you");
  const cheer = cheerText(nudge.cheer);
  if (cheer) parts.push(cheer);
  return parts.join(" · ") || "poked you";
};

/**
 * Friends with something waiting for you go first (most recent nudge first), so they
 * never fall past the dashboard's cut-off; everyone else keeps the given order.
 */
export const nudgedFirst = (
  friends: ReadonlyArray<string>,
  nudges: ReadonlyMap<string, Pick<Nudge, "at">>,
): string[] => {
  const time = (id: string) => nudges.get(id)?.at?.toMillis() ?? Number.MAX_SAFE_INTEGER;
  const nudged = friends.filter((id) => nudges.has(id)).sort((a, b) => time(b) - time(a));
  return [...nudged, ...friends.filter((id) => !nudges.has(id))];
};
