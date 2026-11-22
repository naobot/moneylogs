/**
 * Arranges a user's logs for the Home dashboard:
 *  - now:      ongoing social groups (ending soonest first), then financial logs
 *              (which never end; newest first, as useGetMyLedgers sorts them)
 *  - upcoming: groups not started yet, starting soonest first
 *  - recent:   the few most recently ended groups; the full history lives on /me
 * Logs the user archived are left out entirely. A sublog sits under its parent when the
 * parent is on the dashboard too; otherwise (a parent they're not in, or archived) it's a
 * card of its own.
 *
 * The order deliberately ignores new-activity counts: they arrive a moment after the
 * page renders, and re-sorting then would make cards jump under the user's cursor.
 */
import type { Dayjs } from "dayjs";
import dayjs from "./configuredDayjs";
import { partitionByTime, personalEnd, personalStart } from "./groupBoundaries";
import { ArchivedLogsMap, partitionArchived } from "./archivedLogs";
import { formatDate } from "./dateFormat";
import type { Group } from "@/types/user";
import type { Ledger } from "@/types/ledger";

export const RECENT_LIMIT = 3;

export type DashboardItem =
  | { kind: "social"; id: string; group: Group }
  | {
      kind: "financial";
      id: string;
      ledger: Ledger;
      /** Its sublogs the user is in, shown under it (in the parent's category order). */
      sublogs: Ledger[];
    };

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
  // Same split and ordering as /me's My logs, so the two pages always agree.
  const { ongoing, upcoming, past } = partitionByTime(partitionArchived(groups, user).active, now);
  const activeLedgers = partitionArchived(ledgers, user).active;
  const { top, sublogsOf } = nestSublogs(activeLedgers);

  return {
    now: [
      ...ongoing.map((group) => ({ kind: "social" as const, id: group.id, group })),
      ...top.map((ledger) => ({
        kind: "financial" as const,
        id: ledger.id,
        ledger,
        sublogs: sublogsOf.get(ledger.id) ?? [],
      })),
    ],
    upcoming,
    recent: past.slice(0, RECENT_LIMIT),
    pastCount: past.length,
  };
};

/**
 * Split ledgers into the top level and each parent's sublogs. A sublog nests only when
 * its parent is in the list; its siblings follow the parent's category order.
 */
export const nestSublogs = (
  ledgers: ReadonlyArray<Ledger>,
): { top: Ledger[]; sublogsOf: Map<string, Ledger[]> } => {
  // A sublog names only its link; its parent is the listed log whose line has that link.
  const parentOfLink = new Map<string, string>();
  for (const ledger of ledgers) {
    for (const c of ledger.categories ?? []) {
      if (c.sublog && !c.sublog.unlinkedAt) parentOfLink.set(c.sublog.linkId, ledger.id);
    }
  }
  const sublogsOf = new Map<string, Ledger[]>();
  const top: Ledger[] = [];
  for (const ledger of ledgers) {
    const parentId = ledger.parentLink && parentOfLink.get(ledger.parentLink.linkId);
    if (parentId) {
      sublogsOf.set(parentId, [...(sublogsOf.get(parentId) ?? []), ledger]);
    } else {
      top.push(ledger);
    }
  }
  for (const parent of top) {
    const kids = sublogsOf.get(parent.id);
    if (!kids) continue;
    const order = new Map((parent.categories ?? []).map((c) => [c.id, c.order]));
    const rank = (l: Ledger) => order.get(l.parentLink!.categoryId) ?? Infinity;
    kids.sort((a, b) => rank(a) - rank(b));
  }
  return { top, sublogsOf };
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
  if (stage === "past")
    return `ended ${formatDate(personalEnd(group, timezone), { weekday: false })}`;
  const end = personalEnd(group, timezone);
  return end.isAfter(now) ? `ends ${end.from(now)}` : "posting closed";
};

export const memberLabel = (count: number): string =>
  count <= 1 ? "just you" : `${count} members`;

/**
 * The financial logs for the top bar, in dashboard order, each sublog straight after its
 * parent (so it always sits to the parent's right). A sublog whose parent isn't listed
 * is an ordinary entry of its own.
 */
export const navLedgers = (
  now: ReadonlyArray<DashboardItem>,
): Array<{ ledger: Ledger; sublog: boolean }> =>
  now.flatMap((item) =>
    item.kind === "financial"
      ? [
          { ledger: item.ledger, sublog: false },
          ...item.sublogs.map((ledger) => ({ ledger, sublog: true })),
        ]
      : [],
  );
