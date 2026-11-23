/**
 * Which posts a social log's summary is worked out from (processGroupAnalytics).
 * Pure, so it can be tested without Firestore.
 */

type AnalyticsPostShape = {
  author?: { id?: unknown } | null;
  postDate?: { seconds?: unknown } | null;
};

/**
 * A post has an author id and a timestamp postDate. Older posts written while the rules
 * were open may lack either; they're skipped rather than failing the whole summary.
 */
export const isWellFormedPost = <T extends AnalyticsPostShape>(
  post: T,
): post is T & { author: { id: string }; postDate: { seconds: number } } =>
  typeof post.author?.id === "string" &&
  post.author.id !== "" &&
  typeof post.postDate?.seconds === "number";

/** Well-formed posts dated no later than the cutoff (the log's absolute end, in ms). */
export const postsForAnalytics = <T extends AnalyticsPostShape>(posts: T[], cutoffMs: number) =>
  posts.filter(isWellFormedPost).filter((post) => post.postDate.seconds * 1000 <= cutoffMs);
