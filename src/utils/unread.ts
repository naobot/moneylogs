// Single source of truth for "is there unread activity?" — used both to render the
// unread badges in the nav and to guard the lastViewed writes, so we write to
// Firestore only when there is genuinely something new to mark as read.

type TimestampLike = { seconds: number };

// Firestore resolves a serverTimestamp() to `null` in local snapshots until the server
// acks the write (SnapshotOptions.serverTimestamps defaults to 'none'). So a pending
// mark-as-viewed reads back as `{ lastViewedAt: null }` for as long as the write is in
// flight — long enough to see on a slow mobile connection, indefinitely while offline.
type ViewEntry = { lastViewedAt?: TimestampLike | null } | undefined;

type ViewTracking = Record<string, Record<string, ViewEntry>>;

type CommentSubscriptions = Record<string, ViewEntry>;

// An in-flight mark-as-viewed write. The entry exists, so we have already decided this
// was read; only the timestamp hasn't landed. Treating it as unviewed makes the badge
// reappear the moment the item stops being suppressed.
const isPendingWrite = (entry: ViewEntry): boolean => !!entry && entry.lastViewedAt === null;

type UnreadMember = { id: string; lastUpdated?: Record<string, TimestampLike | undefined> };

type UnreadPost = {
  id: string;
  latestCommentAt?: TimestampLike;
  commentSubscribers?: Array<{ id: string }>;
};

// A member has unread posts when their most recent post in this group is newer than
// the last time the current user viewed that member's log. If the member has never
// posted, there is nothing to be unread. Mirrors the badge logic in LogsMenu.
export const memberHasUnreadPosts = ({
  member,
  viewTracking,
  groupId,
}: {
  member: UnreadMember | undefined;
  viewTracking: ViewTracking | undefined;
  groupId: string;
}): boolean => {
  if (!member) return false;
  const memberLastUpdated = member.lastUpdated?.[groupId];
  if (!memberLastUpdated) return false;
  const entry = viewTracking?.[groupId]?.[member.id];
  if (isPendingWrite(entry)) return false;
  const lastViewedAt = entry?.lastViewedAt;
  if (!lastViewedAt) return true;
  return memberLastUpdated.seconds > lastViewedAt.seconds;
};

// Whether a post has comment activity the current user hasn't seen yet — purely a
// timestamp comparison, independent of subscription. Used to dedupe the
// mark-as-viewed write (skip it when the latest comment is already seen).
export const commentsAreUnseen = (
  post: UnreadPost | undefined,
  commentSubscriptions: CommentSubscriptions | undefined,
): boolean => {
  if (!post?.latestCommentAt) return false;
  const entry = commentSubscriptions?.[post.id];
  if (isPendingWrite(entry)) return false;
  const lastViewedAt = entry?.lastViewedAt;
  if (!lastViewedAt) return true;
  return post.latestCommentAt.seconds > lastViewedAt.seconds;
};

export const isSubscribedToComments = (
  post: UnreadPost | undefined,
  userId: string | undefined,
): boolean => {
  if (!post?.commentSubscribers || !userId) return false;
  return post.commentSubscribers.some((subscriber) => subscriber.id === userId);
};

// The comment badge shows only for posts the user is subscribed to (including their
// own posts, to which the author is auto-subscribed) with unseen comments.
export const postHasUnreadComments = (
  post: UnreadPost | undefined,
  user: { id: string; commentSubscriptions?: CommentSubscriptions } | undefined,
): boolean => {
  if (!user?.id) return false;
  return (
    isSubscribedToComments(post, user.id) && commentsAreUnseen(post, user.commentSubscriptions)
  );
};
