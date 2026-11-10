/**
 * The budget buddy's faces: cat kaomoji, mostly from kaomoji-memorial.jp/cat-emoticons-free
 * (free to copy). Text only, so they follow the theme's ink like any other text.
 */

/** Moods in order from worst to best; `idle` and `asleep` sit outside the scale. */
export const MOOD_SCALE = ["alarmed", "worried", "wary", "content", "happy", "delighted"] as const;

export type ScaleMood = (typeof MOOD_SCALE)[number];
export type BuddyMood = ScaleMood | "idle";

type FaceSet = {
  /** One is picked per day. */
  resting: readonly string[];
  /** Shown while the speech bubble is open. One is picked per day. */
  click: readonly string[];
};

export const FACES: Record<BuddyMood | "asleep", FaceSet> = {
  delighted: {
    resting: ["ฅ(=✧ω✧=)ฅ", "^˵◕ω◕˵^", "ヽ(•̀ω•́ )ゝ✧"],
    click: ["ฅ^ơωơ^ฅ♡", "(●ↀωↀ●)✧"],
  },
  happy: {
    resting: ["ฅ^•ω•^ฅ", "ฅ^>ω<^ฅ", "(=^･ω･^)b"],
    click: ["d(=^･ω･^=)b", "ヾ(э^・ｪ・^)э"],
  },
  content: {
    resting: ["≽^- ˕ -^≼", "ฅ(ﾐ・ﻌ・ﾐ)ฅ", "(=´ﻌ｀=)"],
    click: ["(=^･ω･^)b", "(^･o･^)ﾉ"],
  },
  wary: {
    resting: ["( Φ ω Φ )", "ฅ(◍ •̀ω• ́◍)ฅ", "(=ёェё=)"],
    click: ["ฅ(◍ •̀ω• ́◍)ฅ", "(=ච ﻌ ච=)"],
  },
  worried: {
    resting: ["(=ච ﻌ ච=)", "(=`･∧･´=)", "(^ ｰ̀дｰ́ ^)"],
    click: ["(=｀ω´=)", "(=｀ェ´=)ｼｬｯ"],
  },
  alarmed: {
    resting: ["(｢ФДФ)｢ｼｬｰ", "(^ ; ᯅ ; ^)", "☜(ΦωΦ )へ"],
    click: ["(○｀ω´○)ｼｬｰ!", "Σ(ﾉ｀□´)ノｼｬｰｰ"],
  },
  idle: {
    resting: ["=• · • =", "ヾ(⌒(_´,,−﹃−,,`)_ｺﾞﾛｺﾞﾛ"],
    click: ["( Φ ω Φ )", "(^･o･^)ﾉ"],
  },
  asleep: {
    resting: ["(= ^υ_υ^)..zZ", "(^-人-^)..zZ"],
    click: ["(=ёェё=)"],
  },
};

/** Awake, after a moment's hover: the cat notices you. Cycles through on each hover. */
export const HOVER_FACES = ["(ฅ✧ω✧ฅ)ﾆｬｰ", "ฅ(ↀᴥↀ)ฅ ﾆｬｰ", "ฅ(^ •ω•*^ฅ♡ﾆｬｰ", "(=^. .^=)ﾆｬｰ"] as const;

/** Asleep, it only stirs. */
export const ASLEEP_HOVER_FACE = "(=-ω-=)..z";

export const pick = <T>(list: readonly T[], n: number): T => list[n % list.length];
