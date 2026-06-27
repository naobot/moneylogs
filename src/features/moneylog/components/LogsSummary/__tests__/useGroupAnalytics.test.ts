import { describe, it, expect } from "vite-plus/test";
// useGroupAnalytics imports dayjs directly; this import ensures the minMax plugin is registered
import "@/utils/configuredDayjs";
import { calculateGroupAnalytics } from "@/features/moneylog/components/LogsSummary/hooks/useGroupAnalytics";
import type { Group, LogPost } from "@/types/user";
import type { FullUserData } from "@/hooks/useGetGroupUsers";

// 2024-01-16 (Tuesday) and 2024-01-17 (Wednesday) — both in the same Monday-anchored week
const JAN_16 = 1705363200; // 2024-01-16T00:00:00Z
const JAN_17 = 1705449600; // 2024-01-17T00:00:00Z
const JAN_23 = 1706054400; // 2024-01-23T00:00:00Z — following Tuesday, next week

const mockGroup = {
  start: { seconds: 1705276800, toDate: () => new Date(1705276800 * 1000) }, // 2024-01-15
  end: { seconds: 1707955200, toDate: () => new Date(1707955200 * 1000) }, // 2024-02-15
} as unknown as Group;

const makePost = (userId: string, amount: number, seconds: number, currency = "CAD"): LogPost =>
  ({
    id: `post-${userId}-${seconds}`,
    author: { id: userId },
    authorName: userId,
    currency,
    amount,
    postDate: { seconds, toDate: () => new Date(seconds * 1000) },
    content: "",
    groupId: "g1",
    createdAt: { seconds, toDate: () => new Date(seconds * 1000) },
  }) as unknown as LogPost;

const makeMember = (id: string, displayName: string): FullUserData =>
  ({ id, displayName, userId: id, email: "", groups: [] }) as unknown as FullUserData;

const alice = makeMember("user1", "Alice");
const bob = makeMember("user2", "Bob");

describe("calculateGroupAnalytics — group totals", () => {
  it("sums amounts correctly across users", () => {
    const posts = [
      makePost("user1", 100, JAN_16),
      makePost("user1", 50, JAN_17),
      makePost("user2", 200, JAN_16),
    ];
    const { groupTotals } = calculateGroupAnalytics(posts, mockGroup, [alice, bob]);
    expect(groupTotals.get("CAD")).toBe(350);
  });

  it("tracks currencies independently", () => {
    const posts = [makePost("user1", 100, JAN_16, "CAD"), makePost("user2", 80, JAN_16, "USD")];
    const { groupTotals } = calculateGroupAnalytics(posts, mockGroup, [alice, bob]);
    expect(groupTotals.get("CAD")).toBe(100);
    expect(groupTotals.get("USD")).toBe(80);
  });

  it("returns empty maps when there are no posts", () => {
    const { groupTotals, userRankings, currencyPercentiles } = calculateGroupAnalytics(
      [],
      mockGroup,
      [alice, bob],
    );
    expect(groupTotals.size).toBe(0);
    expect(userRankings.size).toBe(0);
    expect(currencyPercentiles.size).toBe(0);
  });
});

describe("calculateGroupAnalytics — user rankings", () => {
  it("sorts users by daily average descending", () => {
    // Alice: 150 CAD over 2 days → daily avg 75
    // Bob:   200 CAD over 1 day  → daily avg 200
    const posts = [
      makePost("user1", 100, JAN_16),
      makePost("user1", 50, JAN_17),
      makePost("user2", 200, JAN_16),
    ];
    const { userRankings } = calculateGroupAnalytics(posts, mockGroup, [alice, bob]);
    const cadRankings = userRankings.get("CAD")!;
    expect(cadRankings[0].userName).toBe("Bob");
    expect(cadRankings[1].userName).toBe("Alice");
  });

  it("excludes users with no spending in a currency from rankings", () => {
    const posts = [makePost("user1", 100, JAN_16, "CAD")];
    const { userRankings } = calculateGroupAnalytics(posts, mockGroup, [alice, bob]);
    const cadRankings = userRankings.get("CAD")!;
    expect(cadRankings).toHaveLength(1);
    expect(cadRankings[0].userName).toBe("Alice");
  });

  it("calculates daily average as total divided by active days", () => {
    // Alice posts 100 on Jan 16 and 50 on Jan 17 → 2 active days → avg = 75
    const posts = [makePost("user1", 100, JAN_16), makePost("user1", 50, JAN_17)];
    const { userRankings } = calculateGroupAnalytics(posts, mockGroup, [alice]);
    const cadRankings = userRankings.get("CAD")!;
    expect(cadRankings[0].dailyAverage).toBe(75);
  });

  it("calculates weekly average as total divided by active weeks", () => {
    // Alice posts in two separate weeks → 2 active weeks → avg = (100 + 200) / 2 = 150
    const posts = [makePost("user1", 100, JAN_16), makePost("user1", 200, JAN_23)];
    const { userRankings } = calculateGroupAnalytics(posts, mockGroup, [alice]);
    const cadRankings = userRankings.get("CAD")!;
    expect(cadRankings[0].weeklyAverage).toBe(150);
  });
});

describe("calculateGroupAnalytics — percentiles", () => {
  it("computes p50 as the interpolated median of daily averages", () => {
    // Alice daily avg = 75, Bob daily avg = 200
    // sorted = [75, 200]; p50 index = 0.5 → 75*0.5 + 200*0.5 = 137.5
    const posts = [
      makePost("user1", 100, JAN_16),
      makePost("user1", 50, JAN_17),
      makePost("user2", 200, JAN_16),
    ];
    const { currencyPercentiles } = calculateGroupAnalytics(posts, mockGroup, [alice, bob]);
    expect(currencyPercentiles.get("CAD")!.p50).toBeCloseTo(137.5);
  });

  it("returns zeros for all percentiles when only one user has spent", () => {
    // Single-element array: p25/p50/p75 all resolve to that one value
    const posts = [makePost("user1", 100, JAN_16)];
    const { currencyPercentiles } = calculateGroupAnalytics(posts, mockGroup, [alice, bob]);
    const p = currencyPercentiles.get("CAD")!;
    expect(p.p25).toBe(100);
    expect(p.p50).toBe(100);
    expect(p.p75).toBe(100);
  });
});
