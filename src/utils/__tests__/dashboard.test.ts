import { describe, it, expect } from "vite-plus/test";
import {
  arrangeDashboard,
  groupTiming,
  memberLabel,
  navLedgers,
  nestSublogs,
  RECENT_LIMIT,
} from "@/utils/dashboard";
import dayjs from "@/utils/configuredDayjs";
import type { Group } from "@/types/user";
import type { Ledger } from "@/types/ledger";

const ts = (iso: string) => ({ toDate: () => new Date(iso), seconds: Date.parse(iso) / 1000 });
const group = (id: string, start: string, end: string) =>
  ({ id, title: id, start: ts(start), end: ts(end) }) as unknown as Group;
const ledger = (id: string) => ({ id, title: id }) as unknown as Ledger;

const now = dayjs("2024-06-15T12:00:00Z");
const ongoingLate = group("ongoingLate", "2024-06-01T00:00:00Z", "2024-07-30T00:00:00Z");
const ongoingSoon = group("ongoingSoon", "2024-06-10T00:00:00Z", "2024-06-20T00:00:00Z");
const upcomingLate = group("upcomingLate", "2024-09-01T00:00:00Z", "2024-09-10T00:00:00Z");
const upcomingSoon = group("upcomingSoon", "2024-07-01T00:00:00Z", "2024-07-10T00:00:00Z");
const past = [1, 2, 3, 4, 5].map((m) =>
  group(`past${m}`, `2024-0${m}-01T00:00:00Z`, `2024-0${m}-05T00:00:00Z`),
);

const ids = (items: Array<{ id: string }>) => items.map((i) => i.id);

describe("arrangeDashboard", () => {
  it("puts ongoing groups (soonest ending first) before financial logs in 'now'", () => {
    const { now: current } = arrangeDashboard({
      groups: [ongoingLate, ongoingSoon, upcomingSoon],
      ledgers: [ledger("l2"), ledger("l1")],
      user: undefined,
      now,
    });
    expect(current.map((i) => `${i.kind}:${i.id}`)).toEqual([
      "social:ongoingSoon",
      "social:ongoingLate",
      "financial:l2",
      "financial:l1",
    ]);
  });

  it("lists upcoming groups soonest first", () => {
    const { upcoming } = arrangeDashboard({
      groups: [upcomingLate, upcomingSoon, ongoingSoon],
      ledgers: [],
      user: undefined,
      now,
    });
    expect(ids(upcoming)).toEqual(["upcomingSoon", "upcomingLate"]);
  });

  it("keeps only the most recently ended groups, and counts them all", () => {
    const { recent, pastCount } = arrangeDashboard({
      groups: past,
      ledgers: [],
      user: undefined,
      now,
    });
    expect(recent).toHaveLength(RECENT_LIMIT);
    expect(ids(recent)).toEqual(["past5", "past4", "past3"]);
    expect(pastCount).toBe(5);
  });

  it("leaves out everything the user archived", () => {
    const archived = { seconds: 1 };
    const dashboard = arrangeDashboard({
      groups: [ongoingSoon, upcomingSoon, past[4]],
      ledgers: [ledger("l1")],
      user: {
        archivedLogs: {
          ongoingSoon: archived,
          upcomingSoon: archived,
          past5: archived,
          l1: archived,
        },
      },
      now,
    });
    expect(dashboard).toEqual({ now: [], upcoming: [], recent: [], pastCount: 0 });
  });

  it("does not mutate its inputs", () => {
    const input = [ongoingLate, ongoingSoon];
    arrangeDashboard({ groups: input, ledgers: [], user: undefined, now });
    expect(ids(input)).toEqual(["ongoingLate", "ongoingSoon"]);
  });
});

describe("groupTiming", () => {
  const g = group("g", "2024-06-10T00:00:00Z", "2024-06-20T00:00:00Z");

  it("describes each stage", () => {
    expect(groupTiming(g, "ongoing", "UTC", now)).toBe("ends in 5 days");
    expect(groupTiming(g, "upcoming", "UTC", dayjs("2024-06-01T00:00:00Z"))).toBe(
      "starts in 9 days",
    );
    expect(groupTiming(g, "past", "UTC", now)).toBe("ended 20 Jun 2024");
  });

  it("says posting is closed once the viewer's own end has passed", () => {
    const wallClock = {
      ...g,
      endWallClock: "2024-06-20T00:00",
    } as unknown as Group;
    // Midnight has passed in Tokyo, but not yet everywhere.
    expect(groupTiming(wallClock, "ongoing", "Asia/Tokyo", dayjs("2024-06-19T16:00:00Z"))).toBe(
      "posting closed",
    );
  });
});

describe("memberLabel", () => {
  it("reads naturally", () => {
    expect(memberLabel(1)).toBe("just you");
    expect(memberLabel(4)).toBe("4 members");
  });
});

describe("nestSublogs", () => {
  // A sublog names only its link; the parent's line carries the same link id.
  const link = (linkId: string, categoryId: string) =>
    ({ linkId, categoryId, since: "2026-11", linkedBy: "u" }) as Ledger["parentLink"];
  const parent = {
    id: "personal",
    title: "personal",
    categories: [
      { id: "food", name: "food", order: 0 },
      { id: "sublog-pip", name: "pip", order: 1, sublog: { linkId: "L-pip" } },
      { id: "sublog-biz", name: "business", order: 2, sublog: { linkId: "L-biz" } },
    ],
  } as unknown as Ledger;
  const biz = {
    id: "biz",
    title: "business",
    parentLink: link("L-biz", "sublog-biz"),
  } as Ledger;
  const pip = { id: "pip", title: "pip", parentLink: link("L-pip", "sublog-pip") } as Ledger;
  const orphan = { id: "bali", title: "bali", parentLink: link("L-elsewhere", "c") } as Ledger;

  it("puts sublogs under their parent, in its category order", () => {
    const { top, sublogsOf } = nestSublogs([biz, parent, orphan, pip]);
    expect(top.map((l) => l.id)).toEqual(["personal", "bali"]);
    expect(sublogsOf.get("personal")!.map((l) => l.id)).toEqual(["pip", "biz"]);
  });

  it("keeps a sublog on its own when its parent isn't on the dashboard", () => {
    const dashboard = arrangeDashboard({
      groups: [],
      ledgers: [parent, biz],
      user: { archivedLogs: { personal: {} as never } },
    });
    expect(dashboard.now.map((i) => i.id)).toEqual(["biz"]);
  });
});

describe("navLedgers", () => {
  it("puts each sublog straight after its parent, and only financial logs", () => {
    const ledger = (id: string) => ({ id, title: id }) as unknown as Ledger;
    const order = navLedgers([
      { kind: "social", id: "g", group: {} as never },
      {
        kind: "financial",
        id: "personal",
        ledger: ledger("personal"),
        sublogs: [ledger("biz"), ledger("pip")],
      },
      { kind: "financial", id: "home", ledger: ledger("home"), sublogs: [] },
    ]);
    expect(order.map((o) => [o.ledger.id, o.sublog])).toEqual([
      ["personal", false],
      ["biz", true],
      ["pip", true],
      ["home", false],
    ]);
  });
});
