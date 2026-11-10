/**
 * Emoji reactions on a log post, stored as `reactions: { [userDocId]: string[] }`.
 * These helpers turn that per-user map into the per-emoji chips the UI shows.
 */
export type ReactionsMap = Record<string, string[] | undefined>;

export type ReactionSummary = {
  emoji: string;
  count: number;
  /** Whether the viewer is one of the reactors. */
  mine: boolean;
  userIds: string[];
};

/** The curated row shown on hovering the react button, and atop the full picker. */
export const QUICK_REACTIONS = ["👍", "❤️", "😂", "😮", "😢", "🔥", "💸", "👀"] as const;

/** Applied emoji shown inline in a post header; the rest are in the details panel. */
export const MAX_INLINE_REACTIONS = 4;

/** Most emoji one person can leave on a single post. */
export const MAX_REACTIONS_PER_USER = 20;
/** Longest string accepted as one emoji (ZWJ sequences with skin tones run long). */
export const MAX_EMOJI_LENGTH = 16;

/**
 * One entry per distinct emoji, most-used first; ties keep the order in which each emoji
 * first appears, so chips don't shuffle when counts are equal.
 */
export const summarizeReactions = (
  reactions: ReactionsMap | undefined,
  viewerId?: string,
): ReactionSummary[] => {
  if (!reactions) return [];
  const byEmoji = new Map<string, string[]>();
  for (const [userId, emojis] of Object.entries(reactions)) {
    for (const emoji of new Set(emojis ?? [])) {
      const users = byEmoji.get(emoji);
      if (users) users.push(userId);
      else byEmoji.set(emoji, [userId]);
    }
  }
  return Array.from(byEmoji, ([emoji, userIds], order) => ({
    emoji,
    userIds,
    count: userIds.length,
    mine: viewerId ? userIds.includes(viewerId) : false,
    order,
  }))
    .sort((a, b) => b.count - a.count || a.order - b.order)
    .map(({ order: _order, ...summary }) => summary);
};

export const hasReacted = (
  reactions: ReactionsMap | undefined,
  userId: string,
  emoji: string,
): boolean => reactions?.[userId]?.includes(emoji) ?? false;

/** Whether this user may add `emoji` (removing is always allowed). */
export const canAddReaction = (
  reactions: ReactionsMap | undefined,
  userId: string,
  emoji: string,
): boolean => {
  if (!emoji || emoji.length > MAX_EMOJI_LENGTH) return false;
  const mine = reactions?.[userId] ?? [];
  return mine.includes(emoji) || mine.length < MAX_REACTIONS_PER_USER;
};

/** "ana, ben and 2 others" for a chip's tooltip. */
export const reactorNames = (
  userIds: string[],
  nameOf: (id: string) => string | undefined,
  viewerId?: string,
  shown = 3,
): string => {
  const names = userIds.map((id) => (id === viewerId ? "you" : (nameOf(id) ?? "someone")));
  if (names.length <= shown) {
    return names.length === 1
      ? names[0]
      : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
  }
  const rest = names.length - shown;
  return `${names.slice(0, shown).join(", ")} and ${rest} other${rest === 1 ? "" : "s"}`;
};
