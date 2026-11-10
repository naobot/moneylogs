/**
 * Links to one post, and optionally one of its comments, inside a social log:
 * `/g/{groupId}?post={postId}&comment={commentId}`. The group page reads these, opens
 * the author's log, scrolls to the post and, for a comment, opens the comments panel
 * there. A query string rather than a #hash, so it can't collide with Drawer-style hash
 * links. CheckAuth already keeps `search` across the login redirect.
 */

export type PostLink = { postId: string; commentId?: string };

export const POST_PARAM = "post";
export const COMMENT_PARAM = "comment";

export const postLinkHref = (groupId: string, postId: string, commentId?: string): string => {
  const params = new URLSearchParams({ [POST_PARAM]: postId });
  if (commentId) params.set(COMMENT_PARAM, commentId);
  return `/g/${groupId}?${params}`;
};

export const readPostLink = (params: URLSearchParams): PostLink | null => {
  const postId = params.get(POST_PARAM);
  if (!postId) return null;
  const commentId = params.get(COMMENT_PARAM) ?? undefined;
  return commentId ? { postId, commentId } : { postId };
};

/** A copy of `params` without the post link, for clearing it once it's been followed. */
export const withoutPostLink = (params: URLSearchParams): URLSearchParams => {
  const next = new URLSearchParams(params);
  next.delete(POST_PARAM);
  next.delete(COMMENT_PARAM);
  return next;
};

export type PostLinkResolution<P> =
  /** Posts are still arriving (first load or a page in flight): wait. */
  | { status: "waiting" }
  /** Not in the loaded window, but older posts exist: load another page. */
  | { status: "load-more" }
  | { status: "found"; post: P }
  /** Everything is loaded and it isn't there: deleted, or a bad link. */
  | { status: "missing" };

/**
 * Where a linked post stands against the loaded window. Paging is a growing window
 * (useGetLogPosts), so calling this again after each page eventually finds an old post.
 */
export const resolvePostLink = <P extends { id: string }>(
  posts: ReadonlyArray<P>,
  postId: string,
  { hasMore, isLoadingMore }: { hasMore: boolean; isLoadingMore: boolean },
): PostLinkResolution<P> => {
  const post = posts.find((p) => p.id === postId);
  if (post) return { status: "found", post };
  if (isLoadingMore) return { status: "waiting" };
  if (hasMore) return { status: "load-more" };
  return { status: "missing" };
};
