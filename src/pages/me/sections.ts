/** The /me sections. Each id is also its `#hash`, e.g. Home links to /me#logs. */
export type MeSectionId =
  | "profile"
  | "friends"
  | "display"
  | "notifications"
  | "account"
  | "achievements"
  | "logs";

/**
 * Which section a URL hash shows. With no hash, or one that isn't a section, it's the
 * first one; `explicit` is false then, which on phones means "show the section list".
 */
export const resolveSection = <Id extends string>(
  hash: string,
  ids: readonly Id[],
): { id: Id; explicit: boolean } => {
  const wanted = hash.replace(/^#/, "");
  const match = ids.find((id) => id === wanted);
  return match ? { id: match, explicit: true } : { id: ids[0], explicit: false };
};
