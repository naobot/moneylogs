import { describe, it, expect } from "vite-plus/test";
import "@/utils/configuredDayjs";
import {
  buildSpendingSeries,
  autoGranularity,
} from "@/features/moneylog/components/LogsSummary/spendingSeries";
import type { Group, LogPost } from "@/types/user";
import type { FullUserData } from "@/hooks/useGetGroupUsers";

// Noon-UTC timestamps so day bucketing is stable regardless of the runner's timezone.
// 2024-01-15 is a Monday.
const JAN = (day: number) => 1705320000 + (day - 15) * 86400; // Jan 15 12:00 UTC = 1705320000

const shortGroup = {
  id: "g1",
  start: { seconds: JAN(15), toDate: () => new Date(JAN(15) * 1000) }, // Mon Jan 15
  end: { seconds: JAN(19), toDate: () => new Date(JAN(19) * 1000) }, // Fri Jan 19
} as unknown as Group;

const makePost = (amount: number, day: number, currency = "CAD", id?: string): LogPost =>
  ({
    id: id ?? `post-${currency}-${day}-${amount}`,
    author: { id: "user1" },
    authorName: "Alice",
    currency,
    amount,
    postDate: { seconds: JAN(day), toDate: () => new Date(JAN(day) * 1000) },
    content: "",
    groupId: "g1",
    createdAt: { seconds: JAN(day), toDate: () => new Date(JAN(day) * 1000) },
  }) as unknown as LogPost;

const at = (currency: string, day: number, series: ReturnType<typeof buildSpendingSeries>) =>
  series.series
    .get(currency as never)!
    .find((p) => p.key === `2024-01-${String(day).padStart(2, "0")}`)!;

describe("buildSpendingSeries — dense day buckets", () => {
  it("zero-fills every day across the group period", () => {
    const series = buildSpendingSeries([makePost(100, 16), makePost(40, 18)], shortGroup, {
      granularity: "day",
    });
    const cad = series.series.get("CAD")!;
    // Jan 15,16,17,18,19 => 5 buckets
    expect(cad.map((p) => p.key)).toEqual([
      "2024-01-15",
      "2024-01-16",
      "2024-01-17",
      "2024-01-18",
      "2024-01-19",
    ]);
    expect(at("CAD", 15, series).amount).toBe(0);
    expect(at("CAD", 16, series).amount).toBe(100);
    expect(at("CAD", 17, series).amount).toBe(0);
    expect(at("CAD", 18, series).amount).toBe(40);
  });

  it("attaches the contributing posts to their bucket", () => {
    const series = buildSpendingSeries([makePost(100, 16, "CAD", "p-a")], shortGroup);
    expect(at("CAD", 16, series).posts.map((p) => p.id)).toEqual(["p-a"]);
    expect(at("CAD", 15, series).posts).toEqual([]);
  });
});

describe("buildSpendingSeries — currencies", () => {
  it("keeps currencies separate and sorts them by post count descending", () => {
    const series = buildSpendingSeries(
      [makePost(100, 16, "CAD"), makePost(50, 17, "CAD"), makePost(500, 16, "USD")],
      shortGroup,
    );
    // CAD has 2 posts vs USD's 1, so it leads despite the smaller total
    expect(series.currencies).toEqual(["CAD", "USD"]);
    expect(series.counts.get("CAD")).toBe(2);
    expect(series.counts.get("USD")).toBe(1);
    expect(series.totals.get("CAD")).toBe(150);
    expect(series.totals.get("USD")).toBe(500);
    expect(at("USD", 16, series).amount).toBe(500);
    expect(at("CAD", 16, series).amount).toBe(100);
  });

  it("falls back to total descending when post counts tie", () => {
    const series = buildSpendingSeries(
      [makePost(10, 16, "CAD"), makePost(500, 16, "USD")],
      shortGroup,
    );
    expect(series.currencies).toEqual(["USD", "CAD"]);
  });

  it("counts posts rather than summing amounts when ordering", () => {
    // One huge JPY post vs three small CAD posts: CAD wins on data available
    const series = buildSpendingSeries(
      [
        makePost(90000, 16, "JPY"),
        makePost(5, 16, "CAD"),
        makePost(5, 17, "CAD"),
        makePost(5, 18, "CAD"),
      ],
      shortGroup,
    );
    expect(series.currencies).toEqual(["CAD", "JPY"]);
  });

  it("returns empty currencies/series when there are no posts", () => {
    const series = buildSpendingSeries([], shortGroup);
    expect(series.currencies).toEqual([]);
    expect(series.series.size).toBe(0);
  });
});

describe("buildSpendingSeries — cumulative", () => {
  it("accumulates and ends at the currency total", () => {
    const series = buildSpendingSeries([makePost(100, 16), makePost(40, 18)], shortGroup);
    const cad = series.series.get("CAD")!;
    expect(cad.map((p) => p.cumulative)).toEqual([0, 100, 100, 140, 140]);
    expect(cad[cad.length - 1].cumulative).toBe(series.totals.get("CAD"));
  });
});

describe("buildSpendingSeries — pinned post exclusion", () => {
  it("omits the user's pinned post from totals and buckets", () => {
    const user = {
      pinnedPosts: { g1: { pinnedPost: "pinned" } },
    } as unknown as Partial<FullUserData>;
    const series = buildSpendingSeries(
      [makePost(100, 16, "CAD", "pinned"), makePost(40, 18, "CAD", "normal")],
      shortGroup,
      { user },
    );
    expect(series.totals.get("CAD")).toBe(40);
    expect(at("CAD", 16, series).amount).toBe(0);
    expect(at("CAD", 18, series).amount).toBe(40);
  });
});

describe("buildSpendingSeries — week bucketing", () => {
  it("collapses same-week posts into one Monday-anchored bucket", () => {
    const series = buildSpendingSeries([makePost(100, 16), makePost(40, 18)], shortGroup, {
      granularity: "week",
    });
    const cad = series.series.get("CAD")!;
    // Jan 15 is Monday; Jan 16 & 18 fall in that single week
    expect(cad).toHaveLength(1);
    expect(cad[0].key).toBe("2024-01-15");
    expect(cad[0].amount).toBe(140);
    expect(cad[0].label).toContain("wk of");
  });
});

describe("autoGranularity", () => {
  it("uses days for short groups and weeks for long ones", () => {
    expect(autoGranularity(shortGroup)).toBe("day");
    const longGroup = {
      start: { seconds: JAN(15) },
      end: { seconds: JAN(15) + 60 * 86400 },
    } as unknown as Group;
    expect(autoGranularity(longGroup)).toBe("week");
  });
});
