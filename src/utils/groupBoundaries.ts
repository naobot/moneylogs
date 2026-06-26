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
