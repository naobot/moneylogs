import dayjs from "./configuredDayjs";
import type { Dayjs } from "dayjs";
import { Group } from "@/types/user";

// UTC-12: latest timezone on Earth (POSIX naming inverts the sign)
const LATEST_TZ = "Etc/GMT+12";
// UTC+14: earliest timezone on Earth
const EARLIEST_TZ = "Pacific/Kiritimati";

export const personalStart = (group: Group, userTimezone?: string | null): Dayjs => {
  if (group.startWallClock) {
    return dayjs.tz(group.startWallClock, userTimezone || dayjs.tz.guess());
  }
  return dayjs(group.start.toDate());
};

export const personalEnd = (group: Group, userTimezone?: string | null): Dayjs => {
  if (group.endWallClock) {
    return dayjs.tz(group.endWallClock, userTimezone || dayjs.tz.guess());
  }
  return dayjs(group.end.toDate());
};

// Earliest UTC moment when any user could start (UTC+14 users hit wall-clock start first)
export const absoluteStart = (group: Group): Dayjs => {
  if (group.startWallClock) {
    return dayjs.tz(group.startWallClock, EARLIEST_TZ);
  }
  return dayjs(group.start.toDate());
};

// Latest UTC moment when any user could end (UTC-12 users hit wall-clock end last)
export const absoluteEnd = (group: Group): Dayjs => {
  if (group.endWallClock) {
    return dayjs.tz(group.endWallClock, LATEST_TZ);
  }
  return dayjs(group.end.toDate());
};

/**
 * Comparators for listing groups. The underlying Firestore query has no orderBy, so
 * anything rendering a list of groups must sort — these keep every surface agreeing.
 * Compared in milliseconds so groups ending in the same second don't tie arbitrarily.
 */
export const byMostRecentlyEnded = (a: Group, b: Group): number =>
  absoluteEnd(b).valueOf() - absoluteEnd(a).valueOf();

export const bySoonestStarting = (a: Group, b: Group): number =>
  absoluteStart(a).valueOf() - absoluteStart(b).valueOf();

export const bySoonestEnding = (a: Group, b: Group): number =>
  absoluteEnd(a).valueOf() - absoluteEnd(b).valueOf();

/**
 * How long until the group closes for everyone, phrased as a suffix — e.g. "in 5 hours".
 * Shown to users whose own posting window has ended while later timezones are still
 * logging, so the gap between personalEnd and absoluteEnd is at most ~26 hours.
 */
export const timeUntilReadOnly = (group: Group, now: Dayjs = dayjs()): string => {
  const hours = absoluteEnd(group).diff(now, "hour");
  if (hours < 1) return "soon";
  return `in ${hours} hour${hours === 1 ? "" : "s"}`;
};

/**
 * Split groups by where `now` falls in their absolute window, each part sorted the way
 * it is listed: ongoing soonest-ending first, upcoming soonest-starting first, past most
 * recently ended first. Does not mutate the input.
 */
export const partitionByTime = (
  groups: ReadonlyArray<Group>,
  now: Dayjs = dayjs(),
): { ongoing: Group[]; upcoming: Group[]; past: Group[] } => {
  const ongoing: Group[] = [];
  const upcoming: Group[] = [];
  const past: Group[] = [];
  for (const group of groups) {
    if (absoluteStart(group).isAfter(now)) upcoming.push(group);
    else if (absoluteEnd(group).isBefore(now)) past.push(group);
    else ongoing.push(group);
  }
  ongoing.sort(bySoonestEnding);
  upcoming.sort(bySoonestStarting);
  past.sort(byMostRecentlyEnded);
  return { ongoing, upcoming, past };
};
