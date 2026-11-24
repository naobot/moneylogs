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

/**
 * Whether Node knows this IANA zone. Post and user zones are user-written; an unknown one
 * saved into the summary would make every viewer's date conversion throw.
 */
export const isValidTimeZone = (tz: unknown): tz is string => {
  if (typeof tz !== "string" || !tz) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
};

/** Well-formed posts dated no later than the cutoff (the log's absolute end, in ms). */
export const postsForAnalytics = <T extends AnalyticsPostShape>(posts: T[], cutoffMs: number) =>
  posts.filter(isWellFormedPost).filter((post) => post.postDate.seconds * 1000 <= cutoffMs);
