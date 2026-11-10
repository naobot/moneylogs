/**
 * The budget buddy's faces: cat kaomoji from kaomoji-memorial.jp/cat-emoticons-free
 * (free to copy). Text only, so they follow the theme's ink like any other text.
 */

/** Moods in order from worst to best; `idle` and `asleep` sit outside the scale. */
export const MOOD_SCALE = ["alarmed", "worried", "wary", "content", "happy", "delighted"] as const;

export type ScaleMood = (typeof MOOD_SCALE)[number];
export type BuddyMood = ScaleMood | "idle";

type FaceSet = {
  /** One is picked per day. */
  resting: readonly string[];
  /** While a mouse pointer is over it. */
  hover: string;
  /** For a moment after a click. */
  click: string;
};

export const FACES: Record<BuddyMood | "asleep", FaceSet> = {
  delighted: { resting: ["ฅ(=✧ω✧=)ฅ", "^˵◕ω◕˵^"], hover: "ฅ^>ω<^ฅ", click: "ฅ^ơωơ^ฅ♡" },
  happy: { resting: ["ฅ^•ω•^ฅ", "(=^･ω･^)b"], hover: "ฅ^>ω<^ฅ", click: "d(=^･ω･^=)b" },
  content: { resting: ["≽^- ˕ -^≼", "(=´ﻌ｀=)"], hover: "(^･o･^)ﾉ", click: "(=^･ω･^)b" },
  wary: { resting: ["( Φ ω Φ )", "(=ёェё=)"], hover: "｜ωФ)", click: "^ಠ_ಠ^" },
  worried: { resting: ["(=ච ﻌ ච=)", "(=-“-=)"], hover: "(=｀ェ´=)", click: "(=｀ω´=)" },
  alarmed: { resting: ["(｢ФДФ)｢ｼｬｰ", "(○｀ω´○)ｼｬｰ!"], hover: "Σ(ﾉ｀□´)ノ", click: "(=｀ω´=) ｼｬｰ!" },
  idle: { resting: ["｜ωФ)"], hover: "( Φ ω Φ )", click: "(^･o･^)ﾉ" },
  asleep: { resting: ["(= ^υ_υ^)..zZ"], hover: "(=-ω-=)..z", click: "(=ёェё=)" },
};
