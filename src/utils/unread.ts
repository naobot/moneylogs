// Single source of truth for "is there unread activity?" — used both to render the
// unread badges in the nav and to guard the lastViewed writes, so we write to
// Firestore only when there is genuinely something new to mark as read.

type TimestampLike = { seconds: number };

type ViewTracking = Record<string, Record<string, { lastViewedAt?: TimestampLike } | undefined>>;

type CommentSubscriptions = Record<string, { lastViewedAt?: TimestampLike } | undefined>;

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
  const lastViewedAt = viewTracking?.[groupId]?.[member.id]?.lastViewedAt;
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
  const lastViewedAt = commentSubscriptions?.[post.id]?.lastViewedAt;
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
