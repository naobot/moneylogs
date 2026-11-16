/**
 * Public profiles: a server-written projection of the few user-doc fields other people
 * may see. `users/{id}` stays the private single source (it holds email, view tracking,
 * prefs); `profiles/{id}` (same doc id) is what log members, spectators and profile
 * pages read. Pure helpers live here so root Vitest can test them without the SDK.
 */

export const AVATAR_SIZE = 30;

export type PublicProfile = {
  displayName: string;
  displayLocation: string | null;
  timezone: string | null;
  avatar: string[] | null;
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

/** The public fields of a user doc. */
export const publicProfile = (user: Record<string, unknown> | undefined): PublicProfile => ({
  displayName: text(user?.displayName, 80) ?? "someone",
  displayLocation: text(user?.displayLocation, 80),
  timezone: text(user?.timezone, 64),
  avatar: sanitizeAvatar(user?.avatar),
});

/** True when two user-doc snapshots project to the same public profile. */
export const sameProfile = (a: PublicProfile, b: PublicProfile): boolean =>
  a.displayName === b.displayName &&
  a.displayLocation === b.displayLocation &&
  a.timezone === b.timezone &&
  JSON.stringify(a.avatar) === JSON.stringify(b.avatar);
