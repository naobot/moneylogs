/**
 * Words of encouragement a friend can send (a "cheer"). Only the key is stored, so the
 * list can be reworded freely; removing a key just makes old cheers show as a plain poke.
 * The keys are repeated in firestore.rules (nudges), which a test keeps in step.
 */
export const CHEERS = [
  { key: "got_this", text: "you've got this" },
  { key: "proud", text: "proud of you" },
  { key: "keep_going", text: "keep going, you're doing great" },
  { key: "one_day", text: "one day at a time" },
  { key: "small_wins", text: "small wins count too" },
  { key: "treat", text: "go easy on yourself today" },
  { key: "rooting", text: "rooting for you ♡" },
  { key: "high_five", text: "high five!" },
  { key: "thinking", text: "thinking of you" },
  { key: "budget_hero", text: "budget hero, that's you" },
] as const;

export type CheerKey = (typeof CHEERS)[number]["key"];

const BY_KEY = new Map<string, string>(CHEERS.map((c) => [c.key, c.text]));

/** The words for a cheer key; null for none or one that's since been retired. */
export const cheerText = (key: string | null | undefined): string | null =>
  (key && BY_KEY.get(key)) || null;
