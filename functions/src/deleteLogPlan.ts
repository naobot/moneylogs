/**
 * Pure helpers for the deleteLog callable. Dependency-free so they can be unit tested
 * from the root Vitest run.
 */

export type LogKind = "social" | "financial";

export type DeleteLogRequest = { kind: LogKind; id: string };

const ID_RE = /^[A-Za-z0-9_-]{1,128}$/;

/** Validate untrusted callable input. */
export const parseDeleteLogRequest = (data: unknown): DeleteLogRequest | null => {
  if (!data || typeof data !== "object") return null;
  const { kind, id } = data as { kind?: unknown; id?: unknown };
  if (kind !== "social" && kind !== "financial") return null;
  if (typeof id !== "string" || !ID_RE.test(id)) return null;
  return { kind, id };
};

/** The creator's auth uid, mirroring src/utils/logOwnership.ts on the client. */
export const resolveCreator = (
  kind: LogKind,
  data: { createdBy?: unknown; memberUids?: unknown },
): string | undefined => {
  if (typeof data.createdBy === "string" && data.createdBy) return data.createdBy;
  if (kind === "financial" && Array.isArray(data.memberUids)) {
    const first = data.memberUids[0];
    return typeof first === "string" ? first : undefined;
  }
  return undefined;
};

/**
 * Field paths to delete from each participant's user doc, so no reference to the log is
 * left behind. (`groups` is handled separately with arrayRemove.)
 */
export const userFieldsToDelete = (logId: string, postIds: ReadonlyArray<string>): string[] => [
  `pinnedPosts.${logId}`,
  `viewTracking.${logId}`,
  `lastUpdated.${logId}`,
  `archivedLogs.${logId}`,
  ...postIds.map((postId) => `commentSubscriptions.${postId}`),
];

/** Unique user doc ids from document references (or anything with an `id`). */
export const uniqueDocIds = (
  ...lists: ReadonlyArray<ReadonlyArray<{ id?: unknown } | null | undefined> | undefined>
): string[] => {
  const ids = new Set<string>();
  for (const list of lists) {
    for (const ref of list ?? []) {
      if (ref && typeof ref.id === "string" && ref.id) ids.add(ref.id);
    }
  }
  return [...ids];
};

/** Storage prefixes holding a social group's images. */
export const storagePrefixes = (groupId: string): string[] => [
  `inline/${groupId}/`,
  `images/${groupId}/`,
  `uploads/${groupId}/`,
];
