/**
 * Public profiles: a server-written projection of the few user-doc fields other people
 * may see. `users/{id}` stays the private single source (it holds email, view tracking,
 * prefs) and only its owner can read it; `profiles/{id}` (same doc id) is what log
 * members, spectators and profile pages read. Besides name, location, timezone and
 * avatar it carries two per-log activity fields other members' views need: the post
 * each person pinned in a log, and when they last posted there (for "new posts" bells).
 * Both describe posts that are already public in those logs.
 * Pure helpers live here so root Vitest can test them without the SDK.
 */

export const AVATAR_SIZE = 30;

/** Firestore Timestamps (admin or client), or anything with toMillis. */
type TimestampLike = { toMillis: () => number };

export type PublicProfile = {
  displayName: string;
  displayLocation: string | null;
  timezone: string | null;
  avatar: string[] | null;
  /** logId → { pinnedPost: postId | "none" } */
  pinnedPosts: Record<string, { pinnedPost: string }>;
  /** logId → when they last posted there */
  lastUpdated: Record<string, TimestampLike>;
};

const AVATAR_ROW = new RegExp(`^[#.]{${AVATAR_SIZE}}$`);

/** A drawable 30×30 avatar with some ink, else null. Mirrors src/utils/avatar.ts. */
export const sanitizeAvatar = (value: unknown): string[] | null => {
  if (!Array.isArray(value) || value.length !== AVATAR_SIZE) return null;
  if (!value.every((row) => typeof row === "string" && AVATAR_ROW.test(row))) return null;
  if (!value.some((row: string) => row.includes("#"))) return null;
  return value as string[];
};

const text = (value: unknown, max: number): string | null => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim().slice(0, max);
  return trimmed || null;
};

const isMap = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === "object" && !Array.isArray(value);

const pinnedPostsOf = (value: unknown): PublicProfile["pinnedPosts"] => {
  const out: PublicProfile["pinnedPosts"] = {};
  if (!isMap(value)) return out;
  for (const [logId, entry] of Object.entries(value)) {
    if (isMap(entry) && typeof entry.pinnedPost === "string") {
      out[logId] = { pinnedPost: entry.pinnedPost };
    }
  }
  return out;
};

const lastUpdatedOf = (value: unknown): PublicProfile["lastUpdated"] => {
  const out: PublicProfile["lastUpdated"] = {};
  if (!isMap(value)) return out;
  for (const [logId, at] of Object.entries(value)) {
    if (isMap(at) && typeof at.toMillis === "function") out[logId] = at as TimestampLike;
  }
  return out;
};

/** The public fields of a user doc. */
export const publicProfile = (user: Record<string, unknown> | undefined): PublicProfile => ({
  displayName: text(user?.displayName, 80) ?? "someone",
  displayLocation: text(user?.displayLocation, 80),
  timezone: text(user?.timezone, 64),
  avatar: sanitizeAvatar(user?.avatar),
  pinnedPosts: pinnedPostsOf(user?.pinnedPosts),
  lastUpdated: lastUpdatedOf(user?.lastUpdated),
});

const sameKeys = <T>(
  a: Record<string, T>,
  b: Record<string, T>,
  equal: (x: T, y: T) => boolean,
) => {
  const keys = Object.keys(a);
  return keys.length === Object.keys(b).length && keys.every((k) => k in b && equal(a[k], b[k]));
};

/** True when two user-doc snapshots project to the same public profile. */
export const sameProfile = (a: PublicProfile, b: PublicProfile): boolean =>
  a.displayName === b.displayName &&
  a.displayLocation === b.displayLocation &&
  a.timezone === b.timezone &&
  JSON.stringify(a.avatar) === JSON.stringify(b.avatar) &&
  sameKeys(a.pinnedPosts, b.pinnedPosts, (x, y) => x.pinnedPost === y.pinnedPost) &&
  sameKeys(a.lastUpdated, b.lastUpdated, (x, y) => x.toMillis() === y.toMillis());
