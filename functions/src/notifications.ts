/**
 * Notification fan-out: pure helpers. A notification is a doc in
 * `users/{recipientDocId}/notifications/{notificationId}`. Comments notify the post's
 * author and everyone subscribed to its comments (commenting subscribes you; reacting
 * doesn't). Reactions notify the author only. The inbox (src/features/notifications)
 * reads `readAt` (null = unread) and `createdAt`.
 *
 * Dependency-free so they can be unit tested from the root Vitest run; the triggers in
 * index.ts add server timestamps. Mirrored for the client in src/types/notification.ts.
 */

export type NotificationType = "comment" | "reaction";

/** Why a post notification reached its recipient: shown as "your post" or "a post you follow". */
export type PostReason = "author" | "subscriber";

/** Everything except the timestamps, which the trigger sets server-side. */
export type NotificationData = {
  type: NotificationType;
  logKind: "social";
  postId: string;
  groupId: string;
  groupName: string;
  actorId: string;
  actorName: string;
  /** reaction only */
  emoji?: string;
  /** comment only */
  commentId?: string;
  /** comment only: plain-text start of the comment */
  excerpt?: string;
};

type Ref = { id?: unknown } | null | undefined;

/** The post fields fan-out needs. `author`/`group`/`commentSubscribers` are references. */
export type NotifiablePost = {
  author?: Ref;
  group?: Ref;
  groupName?: unknown;
  commentSubscribers?: ReadonlyArray<Ref>;
};

const refId = (ref: Ref): string | undefined =>
  ref && typeof ref.id === "string" && ref.id ? ref.id : undefined;

export const postAuthorId = (post: NotifiablePost): string | undefined => refId(post.author);

/** The post's author, unless they're the actor: who hears about a reaction. */
export const postAuthorRecipients = (post: NotifiablePost, actorId: string): string[] => {
  const author = refId(post.author);
  return author && author !== actorId ? [author] : [];
};

export const recipientReason = (post: NotifiablePost, recipientId: string): PostReason =>
  refId(post.author) === recipientId ? "author" : "subscriber";

/** The post's author and comment subscribers, de-duplicated, never the actor. */
export const notificationRecipients = (post: NotifiablePost, actorId: string): string[] => {
  const ids = new Set<string>();
  const author = refId(post.author);
  if (author) ids.add(author);
  for (const subscriber of post.commentSubscribers ?? []) {
    const id = refId(subscriber);
    if (id) ids.add(id);
  }
  ids.delete(actorId);
  return [...ids];
};

export type ReactionsMap = Record<string, unknown>;
export type ReactionChange = { userId: string; emoji: string };

const emojisOf = (value: unknown): Set<string> =>
  new Set(Array.isArray(value) ? value.filter((e): e is string => typeof e === "string") : []);

/** Which (user, emoji) pairs a post update added and removed. */
export const diffReactions = (
  before: ReactionsMap | undefined,
  after: ReactionsMap | undefined,
): { added: ReactionChange[]; removed: ReactionChange[] } => {
  const added: ReactionChange[] = [];
  const removed: ReactionChange[] = [];
  const userIds = new Set([...Object.keys(before ?? {}), ...Object.keys(after ?? {})]);
  for (const userId of userIds) {
    const was = emojisOf(before?.[userId]);
    const now = emojisOf(after?.[userId]);
    for (const emoji of now) if (!was.has(emoji)) added.push({ userId, emoji });
    for (const emoji of was) if (!now.has(emoji)) removed.push({ userId, emoji });
  }
  return { added, removed };
};

/** Emoji as hex code points, so it can sit in a document id. */
export const emojiKey = (emoji: string): string =>
  Array.from(emoji, (ch) => ch.codePointAt(0)!.toString(16)).join("-");

/**
 * One id per (post, reactor, emoji): re-adding a reaction overwrites rather than
 * duplicating, and removing one can delete its notifications by id.
 */
export const reactionNotificationId = (postId: string, actorId: string, emoji: string) =>
  `reaction_${postId}_${actorId}_${emojiKey(emoji)}`;

export const commentNotificationId = (commentId: string) => `comment_${commentId}`;

/** Plain-text start of a markdown comment, for a notification preview line. */
export const stripMarkdownExcerpt = (markdown: unknown, max = 120): string => {
  if (typeof markdown !== "string") return "";
  const text = markdown
    .replace(/```[\s\S]*?```/g, " ") // fenced code
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ") // images
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1") // links → their text
    .replace(/<[^>]+>/g, " ") // html
    .replace(/^\s{0,3}(#{1,6}|>|[-*+]|\d+\.)\s+/gm, "") // headings, quotes, list markers
    .replace(/[*_~`]+/g, "") // emphasis, inline code
    .replace(/\s+/g, " ")
    .trim();
  return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text;
};

const groupFields = (post: NotifiablePost) => ({
  groupId: refId(post.group) ?? "",
  groupName: typeof post.groupName === "string" ? post.groupName : "",
});

export const buildCommentNotification = (args: {
  post: NotifiablePost;
  postId: string;
  commentId: string;
  actorId: string;
  actorName: string;
  content: unknown;
}): NotificationData => ({
  type: "comment",
  logKind: "social",
  postId: args.postId,
  ...groupFields(args.post),
  actorId: args.actorId,
  actorName: args.actorName,
  commentId: args.commentId,
  excerpt: stripMarkdownExcerpt(args.content),
});

export const buildReactionNotification = (args: {
  post: NotifiablePost;
  postId: string;
  actorId: string;
  actorName: string;
  emoji: string;
}): NotificationData => ({
  type: "reaction",
  logKind: "social",
  postId: args.postId,
  ...groupFields(args.post),
  actorId: args.actorId,
  actorName: args.actorName,
  emoji: args.emoji,
});

/** Split writes into Firestore-batch-sized chunks. */
export const chunk = <T>(items: ReadonlyArray<T>, size = 500): T[][] => {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
};
