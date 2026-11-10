/**
 * Arranges a user's logs for the Home dashboard:
 *  - now:      ongoing social groups (ending soonest first), then financial logs
 *              (which never end; newest first, as useGetMyLedgers sorts them)
 *  - upcoming: groups not started yet, starting soonest first
 *  - recent:   the few most recently ended groups; the full history lives on /me
 * Logs the user archived are left out entirely.
 *
 * The order deliberately ignores new-activity counts: they arrive a moment after the
 * page renders, and re-sorting then would make cards jump under the user's cursor.
 */
import type { Dayjs } from "dayjs";
import dayjs from "./configuredDayjs";
import {
  absoluteEnd,
  absoluteStart,
  byMostRecentlyEnded,
  bySoonestStarting,
  personalEnd,
  personalStart,
} from "./groupBoundaries";
import { ArchivedLogsMap, isArchived } from "./archivedLogs";
import type { Group } from "@/types/user";
import type { Ledger } from "@/types/ledger";

export const RECENT_LIMIT = 3;

export type DashboardItem =
  | { kind: "social"; id: string; group: Group }
  | { kind: "financial"; id: string; ledger: Ledger };

export type Dashboard = {
  now: DashboardItem[];
  upcoming: Group[];
  recent: Group[];
  /** How many ended groups there are in total, so Home can say "see all N". */
  pastCount: number;
};

export const arrangeDashboard = ({
  groups,
  ledgers,
  user,
  now = dayjs(),
}: {
  groups: ReadonlyArray<Group>;
  ledgers: ReadonlyArray<Ledger>;
  user: { archivedLogs?: ArchivedLogsMap } | null | undefined;
  now?: Dayjs;
}): Dashboard => {
  const ongoing: Group[] = [];
  const upcoming: Group[] = [];
  const past: Group[] = [];
  for (const group of groups) {
    if (isArchived(user, group.id)) continue;
    if (absoluteStart(group).isAfter(now)) upcoming.push(group);
    else if (absoluteEnd(group).isBefore(now)) past.push(group);
    else ongoing.push(group);
  }
  ongoing.sort((a, b) => absoluteEnd(a).valueOf() - absoluteEnd(b).valueOf());
  upcoming.sort(bySoonestStarting);
  past.sort(byMostRecentlyEnded);

  return {
    now: [
      ...ongoing.map((group) => ({ kind: "social" as const, id: group.id, group })),
      ...ledgers
        .filter((ledger) => !isArchived(user, ledger.id))
        .map((ledger) => ({ kind: "financial" as const, id: ledger.id, ledger })),
    ],
    upcoming,
    recent: past.slice(0, RECENT_LIMIT),
    pastCount: past.length,
  };
};

/**
 * The timing line on a group's card, in the viewer's own timezone:
 * "ends in 3 days", "starts in 2 weeks", "ended 5 Jun 2024", or "posting closed" for
 * the hours when the viewer's day is over but later timezones are still logging.
 */
export const groupTiming = (
  group: Group,
  stage: "ongoing" | "upcoming" | "past",
  timezone: string | null | undefined,
  now: Dayjs = dayjs(),
): string => {
  if (stage === "upcoming") return `starts ${personalStart(group, timezone).from(now)}`;
  if (stage === "past") return `ended ${personalEnd(group, timezone).format("D MMM YYYY")}`;
  const end = personalEnd(group, timezone);
  return end.isAfter(now) ? `ends ${end.from(now)}` : "posting closed";
};

export const memberLabel = (count: number): string =>
  count <= 1 ? "just you" : `${count} members`;
