/**
 * Log-level activity: "what's new in this log since I last looked?"
 *
 * Each user doc keeps `logLastViewedAt: { [logId]: Timestamp }` — one map for social
 * groups and ledgers alike (their ids are random Firestore ids, as with archivedLogs).
 * It's stamped when the user opens a log and again when they leave it. Home counts the
 * posts or entries other people created after that moment.
 */
import { absoluteEnd, absoluteStart } from "./groupBoundaries";
import { isArchived, ArchivedLogsMap } from "./archivedLogs";
import dayjs from "./configuredDayjs";
import type { Dayjs } from "dayjs";
import type { Group } from "@/types/user";

/**
 * A stored marker. Firestore gives a Timestamp; the localStorage user cache gives a plain
 * `{ seconds, nanoseconds }`; a write still in flight reads back as `null`.
 */
export type VisitMarker = { seconds?: number; nanoseconds?: number; toMillis?: () => number };
export type LogLastViewedAtMap = Record<string, VisitMarker | null | undefined>;

/**
 * The marker in ms; `null` for a pending write (we just stamped it, the server time
 * hasn't come back yet); `undefined` when never stamped.
 */
export const markerMillis = (marker: VisitMarker | null | undefined): number | null | undefined => {
  if (marker === null) return null;
  if (!marker) return undefined;
  if (typeof marker.toMillis === "function") return marker.toMillis();
  if (typeof marker.seconds === "number") {
    return marker.seconds * 1000 + Math.floor((marker.nanoseconds ?? 0) / 1e6);
  }
  return undefined;
};

/** Don't rewrite a marker more often than this when (re)opening a log. */
export const STAMP_ON_OPEN_MIN_GAP_MS = 2 * 60 * 1000;
/** On leaving, skip only if we stamped moments ago (a quick bounce in and out). */
export const STAMP_ON_LEAVE_MIN_GAP_MS = 10 * 1000;

/**
 * Whether to write a fresh marker. `lastStampMs` is the most recent known stamp: the
 * stored marker or one this tab just wrote, whichever is newer. A pending write (`null`)
 * counts as just stamped.
 */
export const shouldStampVisit = (
  lastStampMs: number | null | undefined,
  nowMs: number,
  minGapMs: number,
): boolean => {
  if (lastStampMs === null) return false;
  if (lastStampMs === undefined) return true;
  return nowMs - lastStampMs >= minGapMs;
};

export type ActivityTarget =
  | { kind: "social"; id: string; sinceMs: number }
  | { kind: "financial"; id: string; sinceMs: number };

type ActivityUser =
  | {
      logLastViewedAt?: LogLastViewedAtMap;
      archivedLogs?: ArchivedLogsMap;
    }
  | null
  | undefined;

/**
 * Which logs Home should count new activity for, and since when. Only logs that can
 * still receive posts (ongoing groups, all ledgers), not archived, and visited before —
 * a log with no marker yet shows no badge, so nobody sees their whole history as "new"
 * the first time this ships.
 */
export const logsToCount = ({
  groups,
  ledgers,
  user,
  now = dayjs(),
}: {
  groups: ReadonlyArray<Group>;
  ledgers: ReadonlyArray<{ id: string }>;
  user: ActivityUser;
  now?: Dayjs;
}): ActivityTarget[] => {
  const since = (id: string) => markerMillis(user?.logLastViewedAt?.[id]);
  const targets: ActivityTarget[] = [];

  for (const group of groups) {
    if (isArchived(user, group.id)) continue;
    if (absoluteStart(group).isAfter(now) || absoluteEnd(group).isBefore(now)) continue;
    const sinceMs = since(group.id);
    if (typeof sinceMs === "number") targets.push({ kind: "social", id: group.id, sinceMs });
  }
  for (const ledger of ledgers) {
    if (isArchived(user, ledger.id)) continue;
    const sinceMs = since(ledger.id);
    if (typeof sinceMs === "number") targets.push({ kind: "financial", id: ledger.id, sinceMs });
  }
  return targets;
};

/** "3 new posts", "1 new entry". */
export const formatNewCount = (count: number, kind: "social" | "financial"): string => {
  const noun = kind === "social" ? "post" : "entry";
  const plural = kind === "social" ? "posts" : "entries";
  return `${count} new ${count === 1 ? noun : plural}`;
};
