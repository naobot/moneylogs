/**
 * "Ending soon" and "has ended" notifications for social logs: pure helpers for the
 * hourly notifyLogTimeline job. Each member's end is their own: the log's wall-clock end
 * in their timezone (personalEnd in src/utils/groupBoundaries.ts). That's why this runs
 * per member rather than per log.
 *
 * Dependency-free (Intl, no dayjs) so it can be unit tested from the root Vitest run.
 */
import { isNotificationEnabled } from "./notificationPrefs";

const HOUR_MS = 3_600_000;
export const DAY_MS = 24 * HOUR_MS;

/** Matches the in-log warning in Group.tsx: under 24 hours before your own end. */
export const ENDING_SOON_MS = DAY_MS;
/** How long after your end an "ended" notification can still go out (missed runs, deploys). */
export const ENDED_LOOKBACK_MS = DAY_MS;
/**
 * How far a member's personal end can sit from the stored `end` Timestamp. `end` is the
 * wall clock read in the creator's zone, and members range from UTC-12 to UTC+14.
 */
export const WALL_CLOCK_SPREAD_MS = 26 * HOUR_MS;

// UTC-12, the last zone to reach any wall-clock time (POSIX inverts the sign).
const LATEST_TZ = "Etc/GMT+12";

/** The range of `end` values whose members might be due a notification at `now`. */
export const timelineQueryWindow = (now: number) => ({
  from: now - ENDED_LOOKBACK_MS - WALL_CLOCK_SPREAD_MS,
  to: now + ENDING_SOON_MS + WALL_CLOCK_SPREAD_MS,
});

const WALL_CLOCK = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/;

/** The zone's offset from UTC at an instant, in ms. Throws on an unknown zone. */
const zoneOffsetMs = (instant: number, timeZone: string): number => {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(new Date(instant));
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  const asUtc = Date.UTC(
    get("year"),
    get("month") - 1,
    get("day"),
    get("hour"),
    get("minute"),
    get("second"),
  );
  return asUtc - Math.floor(instant / 1000) * 1000;
};

/**
 * The instant a "YYYY-MM-DDTHH:mm" wall-clock time occurs in a zone, like
 * `dayjs.tz(wallClock, timeZone)`. Returns null for a malformed time or unknown zone.
 */
export const wallClockToInstant = (wallClock: string, timeZone: string): number | null => {
  const m = WALL_CLOCK.exec(wallClock);
  if (!m) return null;
  const [, y, mo, d, h, mi, s] = m;
  const asUtc = Date.UTC(+y, +mo - 1, +d, +h, +mi, +(s ?? 0));
  try {
    // Guess with the offset at the naive instant, then correct once if that guess
    // landed across a DST change.
    const first = asUtc - zoneOffsetMs(asUtc, timeZone);
    const second = asUtc - zoneOffsetMs(first, timeZone);
    return second;
  } catch {
    return null;
  }
};

export type TimelineGroup = {
  id: string;
  title: string;
  endWallClock?: string;
  /** The stored `end` Timestamp, in ms: the fallback for legacy logs and unknown zones. */
  endMs: number;
};

export type TimelineMember = { timezone?: unknown; notificationPrefs?: unknown };

export const personalEndMs = (group: TimelineGroup, timezone?: unknown): number => {
  if (group.endWallClock && typeof timezone === "string" && timezone) {
    const at = wallClockToInstant(group.endWallClock, timezone);
    if (at !== null) return at;
  }
  return group.endMs;
};

export const absoluteEndMs = (group: TimelineGroup): number =>
  (group.endWallClock && wallClockToInstant(group.endWallClock, LATEST_TZ)) || group.endMs;

export const timelineNotificationId = (type: "log_ending" | "log_ended", groupId: string) =>
  `${type}_${groupId}`;

export type TimelineNotification = {
  id: string;
  data: {
    type: "log_ending" | "log_ended";
    groupId: string;
    groupName: string;
    logKind: "social";
    endsAt: Date;
    summaryAt?: Date;
  };
};

/**
 * What one member is due at `now`: "ending" while their end is under a day away, then
 * "ended" for a day after it passes. Ids are fixed per log, so the hourly job
 * re-proposing the same one is harmless (it's created at most once).
 */
export const timelineNotificationsFor = (
  group: TimelineGroup,
  member: TimelineMember,
  now: number,
): TimelineNotification[] => {
  const end = personalEndMs(group, member.timezone);
  const base = {
    groupId: group.id,
    groupName: group.title,
    logKind: "social" as const,
    endsAt: new Date(end),
  };

  if (end > now && end - now < ENDING_SOON_MS) {
    if (!isNotificationEnabled(member, "log_ending")) return [];
    return [
      {
        id: timelineNotificationId("log_ending", group.id),
        data: { type: "log_ending", ...base },
      },
    ];
  }
  if (end <= now && now - end < ENDED_LOOKBACK_MS) {
    if (!isNotificationEnabled(member, "log_ended")) return [];
    return [
      {
        id: timelineNotificationId("log_ended", group.id),
        data: { type: "log_ended", ...base, summaryAt: new Date(absoluteEndMs(group)) },
      },
    ];
  }
  return [];
};
