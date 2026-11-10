import { describe, it, expect } from "vite-plus/test";
import {
  formatNewCount,
  logsToCount,
  markerMillis,
  shouldStampVisit,
  STAMP_ON_LEAVE_MIN_GAP_MS,
  STAMP_ON_OPEN_MIN_GAP_MS,
} from "@/utils/logActivity";
import dayjs from "@/utils/configuredDayjs";
import type { Group } from "@/types/user";

const ts = (iso: string) => ({ toDate: () => new Date(iso), seconds: Date.parse(iso) / 1000 });
const group = (id: string, start: string, end: string) =>
  ({ id, title: id, start: ts(start), end: ts(end) }) as unknown as Group;

describe("markerMillis", () => {
  it("reads Firestore Timestamps and cached plain objects", () => {
    expect(markerMillis({ toMillis: () => 1234 })).toBe(1234);
    expect(markerMillis({ seconds: 10, nanoseconds: 5_000_000 })).toBe(10_005);
    expect(markerMillis({ seconds: 10 })).toBe(10_000);
  });

  it("distinguishes a pending write (null) from never stamped (undefined)", () => {
    expect(markerMillis(null)).toBeNull();
    expect(markerMillis(undefined)).toBeUndefined();
    expect(markerMillis({})).toBeUndefined();
  });
});

describe("shouldStampVisit", () => {
  const now = 1_000_000_000;

  it("stamps a log never visited", () => {
    expect(shouldStampVisit(undefined, now, STAMP_ON_OPEN_MIN_GAP_MS)).toBe(true);
  });

  it("never stamps over a write still in flight", () => {
    expect(shouldStampVisit(null, now, 0)).toBe(false);
  });

  it("throttles by the given gap", () => {
    expect(shouldStampVisit(now - 60_000, now, STAMP_ON_OPEN_MIN_GAP_MS)).toBe(false);
    expect(shouldStampVisit(now - STAMP_ON_OPEN_MIN_GAP_MS, now, STAMP_ON_OPEN_MIN_GAP_MS)).toBe(
      true,
    );
    expect(shouldStampVisit(now - 60_000, now, STAMP_ON_LEAVE_MIN_GAP_MS)).toBe(true);
    expect(shouldStampVisit(now - 2_000, now, STAMP_ON_LEAVE_MIN_GAP_MS)).toBe(false);
  });
});

describe("logsToCount", () => {
  const now = dayjs("2024-06-15T12:00:00Z");
  const ongoing = group("ongoing", "2024-06-01T00:00:00Z", "2024-06-30T00:00:00Z");
  const upcoming = group("upcoming", "2024-07-01T00:00:00Z", "2024-07-10T00:00:00Z");
  const past = group("past", "2024-05-01T00:00:00Z", "2024-05-10T00:00:00Z");
  const marker = { seconds: 1_718_000_000 };

  it("counts ongoing groups and ledgers that have a marker", () => {
    const user = {
      logLastViewedAt: { ongoing: marker, upcoming: marker, past: marker, l1: marker },
    };
    expect(
      logsToCount({ groups: [ongoing, upcoming, past], ledgers: [{ id: "l1" }], user, now }),
    ).toEqual([
      { kind: "social", id: "ongoing", sinceMs: 1_718_000_000_000 },
      { kind: "financial", id: "l1", sinceMs: 1_718_000_000_000 },
    ]);
  });

  it("skips logs never visited or with a pending stamp", () => {
    const user = { logLastViewedAt: { l2: null } };
    expect(
      logsToCount({ groups: [ongoing], ledgers: [{ id: "l1" }, { id: "l2" }], user, now }),
    ).toEqual([]);
  });

  it("skips logs the user archived", () => {
    const user = {
      logLastViewedAt: { ongoing: marker, l1: marker },
      archivedLogs: { ongoing: { seconds: 1 }, l1: { seconds: 1 } },
    };
    expect(logsToCount({ groups: [ongoing], ledgers: [{ id: "l1" }], user, now })).toEqual([]);
  });

  it("handles a missing user", () => {
    expect(
      logsToCount({ groups: [ongoing], ledgers: [{ id: "l1" }], user: undefined, now }),
    ).toEqual([]);
  });
});

describe("formatNewCount", () => {
  it("pluralises per kind", () => {
    expect(formatNewCount(1, "social")).toBe("1 new post");
    expect(formatNewCount(3, "social")).toBe("3 new posts");
    expect(formatNewCount(1, "financial")).toBe("1 new entry");
    expect(formatNewCount(2, "financial")).toBe("2 new entries");
  });
});
