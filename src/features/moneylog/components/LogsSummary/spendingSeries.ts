import dayjs from "@/utils/configuredDayjs";
import { Currency, Group, LogPost } from "@/types/user";
import { FullUserData } from "@/hooks/useGetGroupUsers";

export type Granularity = "day" | "week";

export type SpendingPoint = {
  key: string; // bucket key, YYYY-MM-DD (day, or that week's Monday)
  date: dayjs.Dayjs; // bucket start
  label: string; // short human label for the axis / tooltip
  amount: number; // spend in this bucket for the currency
  cumulative: number; // running total up to and including this bucket
  posts: LogPost[]; // posts contributing to this bucket for the currency
};

export type SpendingSeries = {
  granularity: Granularity;
  currencies: Currency[]; // present currencies, most posts first
  totals: Map<Currency, number>;
  counts: Map<Currency, number>; // number of contributing posts per currency
  series: Map<Currency, SpendingPoint[]>; // dense (zero-filled) per currency
};

type BuildOptions = {
  user?: Partial<FullUserData>;
  granularity?: Granularity;
};

// Long groups get weekly buckets so the axis doesn't turn into a hairline forest.
const WEEK_GRANULARITY_THRESHOLD_DAYS = 35;

export const autoGranularity = (group: Group): Granularity => {
  const start = dayjs(group.start.seconds * 1000);
  const end = dayjs(group.end.seconds * 1000);
  return end.diff(start, "day") + 1 > WEEK_GRANULARITY_THRESHOLD_DAYS ? "week" : "day";
};

// Monday-based week start, matching the week keys used in SpendingInsights.
const mondayOf = (d: dayjs.Dayjs): dayjs.Dayjs => {
  const dayOfWeek = d.day() === 0 ? 6 : d.day() - 1; // Sun=0 -> 6, others shift down
  return d.subtract(dayOfWeek, "day").startOf("day");
};

const bucketDateOf = (d: dayjs.Dayjs, granularity: Granularity): dayjs.Dayjs =>
  granularity === "week" ? mondayOf(d) : d.startOf("day");

const keyOf = (d: dayjs.Dayjs, granularity: Granularity): string =>
  bucketDateOf(d, granularity).format("YYYY-MM-DD");

const labelOf = (d: dayjs.Dayjs, granularity: Granularity): string =>
  granularity === "week" ? `wk of ${d.format("D MMM")}` : d.format("D MMM");

/**
 * Bucket a set of posts into a dense, zero-filled time series per currency.
 *
 * Mirrors SpendingInsights' aggregation so the graph agrees with the textual
 * totals: excludes the user's pinned post and posts outside [group.start, group.end]
 * (browser-tz, day-granular), and buckets each post by its cached postTimezone when
 * available (else browser tz).
 */
export const buildSpendingSeries = (
  logPosts: LogPost[],
  group: Group,
  { user, granularity = "day" }: BuildOptions = {},
): SpendingSeries => {
  const pinnedPostId = user?.pinnedPosts?.[group.id]?.pinnedPost;
  const groupStart = dayjs(group.start.seconds * 1000);
  const groupEnd = dayjs(group.end.seconds * 1000);

  const hasCachedAnalytics = group.analytics?.isCalculated;
  const postsMetadata = group.analytics?.posts;

  const legitimatePosts = logPosts.filter((log) => {
    const postDate = dayjs(log.postDate.seconds * 1000);
    const isNotPinned = pinnedPostId ? log.id !== pinnedPostId : true;
    return (
      isNotPinned && !postDate.isAfter(groupEnd, "day") && !postDate.isBefore(groupStart, "day")
    );
  });

  // Aggregate amount + posts per (currency, bucket key).
  type Bucket = { date: dayjs.Dayjs; amount: number; posts: LogPost[] };
  const perCurrency = new Map<Currency, Map<string, Bucket>>();
  const totals = new Map<Currency, number>();
  const counts = new Map<Currency, number>();

  legitimatePosts.forEach((log) => {
    const tz =
      hasCachedAnalytics && postsMetadata?.[log.id]?.postTimezone
        ? postsMetadata[log.id].postTimezone
        : undefined;
    const postDate = tz
      ? dayjs(log.postDate.seconds * 1000).tz(tz)
      : dayjs(log.postDate.seconds * 1000);
    const key = keyOf(postDate, granularity);
    const currency = log.currency;
    const amount = Number(log.amount) || 0;

    if (!perCurrency.has(currency)) perCurrency.set(currency, new Map());
    const buckets = perCurrency.get(currency)!;
    if (!buckets.has(key)) buckets.set(key, { date: dayjs(key), amount: 0, posts: [] });
    const bucket = buckets.get(key)!;
    bucket.amount += amount;
    bucket.posts.push(log);

    totals.set(currency, (totals.get(currency) ?? 0) + amount);
    counts.set(currency, (counts.get(currency) ?? 0) + 1);
  });

  // Most-logged currency first, so the graph opens on the currency with the richest
  // data. Totals are not comparable across currencies (¥50,000 vs $20), so post count
  // is the meaningful signal; total is only a tie-break for a stable order.
  const currencies = [...counts.keys()].sort((a, b) => {
    const byCount = (counts.get(b) ?? 0) - (counts.get(a) ?? 0);
    return byCount !== 0 ? byCount : (totals.get(b) ?? 0) - (totals.get(a) ?? 0);
  });

  if (currencies.length === 0) {
    return { granularity, currencies, totals, counts, series: new Map() };
  }

  // Continuous axis spanning the group period and every populated bucket.
  const candidateDates: dayjs.Dayjs[] = [
    bucketDateOf(groupStart, granularity),
    bucketDateOf(groupEnd, granularity),
  ];
  perCurrency.forEach((buckets) => buckets.forEach((b) => candidateDates.push(b.date)));

  let cursor = candidateDates.reduce((min, d) => (d.isBefore(min) ? d : min), candidateDates[0]);
  const axisEnd = candidateDates.reduce((max, d) => (d.isAfter(max) ? d : max), candidateDates[0]);

  const axis: { key: string; date: dayjs.Dayjs }[] = [];
  while (!cursor.isAfter(axisEnd, "day")) {
    axis.push({ key: cursor.format("YYYY-MM-DD"), date: cursor });
    cursor = granularity === "week" ? cursor.add(7, "day") : cursor.add(1, "day");
  }

  const series = new Map<Currency, SpendingPoint[]>();
  currencies.forEach((currency) => {
    const buckets = perCurrency.get(currency) ?? new Map<string, Bucket>();
    let cumulative = 0;
    const points = axis.map(({ key, date }) => {
      const bucket = buckets.get(key);
      const amount = bucket?.amount ?? 0;
      cumulative += amount;
      return {
        key,
        date,
        label: labelOf(date, granularity),
        amount,
        cumulative,
        posts: bucket?.posts ?? [],
      };
    });
    series.set(currency, points);
  });

  return { granularity, currencies, totals, counts, series };
};
