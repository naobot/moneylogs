/**
 * Personal archiving: each member can hide logs (social groups or financial ledgers) from
 * their own lists. Stored on their user doc as `archivedLogs: { [logId]: Timestamp }`.
 * Group and ledger ids are random Firestore ids, so both kinds share one map.
 */

type ArchiveStamp = { seconds?: number; toMillis?: () => number } | null | undefined;

export type ArchivedLogsMap = Record<string, ArchiveStamp>;

type WithArchived = { archivedLogs?: ArchivedLogsMap } | null | undefined;

export const isArchived = (user: WithArchived, logId: string): boolean =>
  !!user?.archivedLogs && logId in user.archivedLogs;

/**
 * When it was archived, in ms. A just-written archive has a pending server timestamp
 * (null in the local snapshot), so treat it as "now" to keep it at the top.
 */
export const archivedAtMillis = (user: WithArchived, logId: string): number => {
  const stamp = user?.archivedLogs?.[logId];
  if (!stamp) return Number.POSITIVE_INFINITY;
  if (typeof stamp.toMillis === "function") return stamp.toMillis();
  return (stamp.seconds ?? 0) * 1000;
};

/** Split logs into active and archived; archived newest-archived first. Does not mutate. */
export const partitionArchived = <T extends { id: string }>(
  logs: ReadonlyArray<T>,
  user: WithArchived,
): { active: T[]; archived: T[] } => {
  const active: T[] = [];
  const archived: T[] = [];
  for (const log of logs) (isArchived(user, log.id) ? archived : active).push(log);
  archived.sort((a, b) => archivedAtMillis(user, b.id) - archivedAtMillis(user, a.id));
  return { active, archived };
};
