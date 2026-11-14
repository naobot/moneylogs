/**
 * Knick-knack finds: pure helpers for maybeFindKnickKnack. Mirrors the client catalog
 * (src/features/ledger/buddy/knickknacks/catalog.ts and seasons.ts); a root test keeps
 * the two in step. Dependency-free so it can be unit tested from the root Vitest run.
 *
 * A day earns at most one roll: by logging an entry, or, on a day with nothing logged,
 * by checking in on a financial log in the evening. The odds lean mostly on budget pace
 * (graded: comfortably under pays most, over pays nothing) and a little on steady
 * logging, over a small base everyone gets. On a hit, rarer items are picked less often.
 */

export type Season = "spring" | "summer" | "autumn" | "winter";
export type Hemisphere = "north" | "south";
export type Rarity = "common" | "rare";

/** How often each rarity is picked, relative to the others in season. */
export const RARITY_WEIGHTS: Record<Rarity, number> = { common: 3, rare: 1 };

export const KNICK_KNACK_FINDS = {
  acorn: { seasons: ["autumn"], rarity: "common" },
  pinecone: { seasons: ["autumn", "winter"], rarity: "common" },
  maple_leaf: { seasons: ["autumn"], rarity: "common" },
  apple: { seasons: ["autumn"], rarity: "rare" },
  pine_branch: { seasons: ["winter"], rarity: "common" },
  holly: { seasons: ["winter"], rarity: "common" },
  snowdrop: { seasons: ["winter"], rarity: "rare" },
  cherry_blossom: { seasons: ["spring"], rarity: "rare" },
  tulip: { seasons: ["spring"], rarity: "common" },
  lilac: { seasons: ["spring"], rarity: "common" },
  daisy: { seasons: ["summer"], rarity: "common" },
  sunflower: { seasons: ["summer"], rarity: "common" },
  dragonfly: { seasons: ["summer"], rarity: "rare" },
} as const satisfies Record<string, { seasons: readonly Season[]; rarity: Rarity }>;

export type KnickKnackId = keyof typeof KNICK_KNACK_FINDS;

const SOUTHERN_PREFIXES = ["Australia/", "Antarctica/", "America/Argentina/"];

const SOUTHERN_ZONES = new Set([
  "Pacific/Auckland",
  "Pacific/Chatham",
  "Pacific/Fiji",
  "Pacific/Tongatapu",
  "Pacific/Apia",
  "Pacific/Noumea",
  "America/Buenos_Aires",
  "America/Santiago",
  "America/Montevideo",
  "America/Asuncion",
  "America/Sao_Paulo",
  "America/La_Paz",
  "America/Lima",
  "Africa/Johannesburg",
  "Africa/Maputo",
  "Africa/Harare",
  "Africa/Windhoek",
  "Africa/Gaborone",
  "Africa/Maseru",
  "Africa/Mbabane",
  "Africa/Lusaka",
  "Indian/Mauritius",
  "Indian/Reunion",
  "Indian/Antananarivo",
]);

export const hemisphereOf = (timezone?: string | null): Hemisphere => {
  if (!timezone) return "north";
  if (SOUTHERN_ZONES.has(timezone)) return "south";
  return SOUTHERN_PREFIXES.some((p) => timezone.startsWith(p)) ? "south" : "north";
};

const NORTHERN: readonly Season[] = [
  "winter",
  "winter",
  "spring",
  "spring",
  "spring",
  "summer",
  "summer",
  "summer",
  "autumn",
  "autumn",
  "autumn",
  "winter",
];

/** `month` is 1–12. The southern hemisphere is six months on. */
export const seasonOf = (month: number, hemisphere: Hemisphere = "north"): Season =>
  NORTHERN[(month - 1 + (hemisphere === "south" ? 6 : 0)) % 12];

export const findableIn = ({
  month,
  timezone,
}: {
  month: number;
  timezone?: string | null;
}): KnickKnackId[] => {
  const season = seasonOf(month, hemisphereOf(timezone));
  return (Object.keys(KNICK_KNACK_FINDS) as KnickKnackId[]).filter((id) =>
    (KNICK_KNACK_FINDS[id].seasons as readonly Season[]).includes(season),
  );
};

/** "YYYY-MM-DD" at `now` in `timezone`; UTC when the zone is missing or unknown. */
export const dayIn = (now: number, timezone?: string | null): string => {
  try {
    return new Intl.DateTimeFormat("en-CA", { timeZone: timezone || "UTC" }).format(now);
  } catch {
    return new Date(now).toISOString().slice(0, 10);
  }
};

/** Everyone's chance on a roll, whatever their habits. */
export const BASE_CHANCE = 0.015;
/** Up to this much more for logging on most recent days. */
export const STEADY_BONUS = 0.015;
/** Up to this much more for spending under budget pace; half of it right on pace. */
export const PACE_BONUS = 0.05;
/** Days with spending, out of the last 14, that count as fully steady. */
export const STEADY_DAYS = 10;
/** At or under this share of the pace budget counts as comfortably under. */
export const COMFORTABLY_UNDER = 0.6;
/** Rolls at least this far apart, so hopping timezones can't make a second "day". */
export const MIN_ROLL_GAP_MS = 20 * 3_600_000;

/**
 * The pace part, from `paceRatio` (spending ÷ the budget's share of the month so far,
 * the worst currency; null without budgets): full when comfortably under, sliding to
 * half right on pace, nothing once over.
 */
export const paceBonus = (paceRatio: number | null): number => {
  if (paceRatio === null || paceRatio > 1) return 0;
  if (paceRatio <= COMFORTABLY_UNDER) return PACE_BONUS;
  const t = (paceRatio - COMFORTABLY_UNDER) / (1 - COMFORTABLY_UNDER);
  return PACE_BONUS * (1 - t / 2);
};

export const findChance = ({
  loggedDays,
  paceRatio,
}: {
  loggedDays: number;
  paceRatio: number | null;
}) =>
  BASE_CHANCE +
  (Math.min(Math.max(loggedDays, 0), STEADY_DAYS) / STEADY_DAYS) * STEADY_BONUS +
  paceBonus(paceRatio);

export type RollMarker = { lastDay?: string; lastAtMs?: number };

export const canRoll = ({
  marker,
  today,
  now,
}: {
  marker?: RollMarker | null;
  today: string;
  now: number;
}): boolean => {
  if (!marker) return true;
  if (marker.lastDay === today) return false;
  return typeof marker.lastAtMs !== "number" || now - marker.lastAtMs >= MIN_ROLL_GAP_MS;
};

/** On a hit, one item from what's in season, weighted by rarity. */
export const rollFind = ({
  rand,
  chance,
  findable,
}: {
  rand: () => number;
  chance: number;
  findable: readonly KnickKnackId[];
}): KnickKnackId | null => {
  if (!findable.length || rand() >= chance) return null;
  const weights = findable.map((id) => RARITY_WEIGHTS[KNICK_KNACK_FINDS[id].rarity]);
  let pick = rand() * weights.reduce((a, b) => a + b, 0);
  for (let i = 0; i < findable.length; i++) {
    pick -= weights[i];
    if (pick < 0) return findable[i];
  }
  return findable[findable.length - 1];
};

/** Days with any spending among the 14 before `today`, from month docs' byDay. */
export const loggedDaysBefore = (
  today: string,
  byMonth: Record<string, { byDay?: Record<string, Record<string, number>> } | undefined>,
): number => {
  let days = 0;
  const t = Date.UTC(+today.slice(0, 4), +today.slice(5, 7) - 1, +today.slice(8, 10));
  for (let back = 1; back <= 14; back++) {
    const d = new Date(t - back * 86_400_000).toISOString();
    const amounts = byMonth[d.slice(0, 7)]?.byDay?.[d.slice(8, 10)] ?? {};
    if (Object.values(amounts).some((v) => v > 0)) days++;
  }
  return days;
};

/** The hour (0–23) at `now` in `timezone`; UTC when the zone is missing or unknown. */
export const hourIn = (now: number, timezone?: string | null): number => {
  try {
    const hour = new Intl.DateTimeFormat("en-GB", {
      timeZone: timezone || "UTC",
      hour: "2-digit",
      hourCycle: "h23",
    }).format(now);
    return Number(hour);
  } catch {
    return new Date(now).getUTCHours();
  }
};

/**
 * A day with nothing logged can still earn its roll, from this hour on: the same hour
 * the buddy's evening check-in starts (src/features/ledger/buddy/buddyCheckIn.ts).
 */
export const QUIET_DAY_FROM_HOUR = 17;

export const parseQuietDayRequest = (data: unknown): { ledgerId: string } | null => {
  const ledgerId = (data as { ledgerId?: unknown } | null)?.ledgerId;
  return typeof ledgerId === "string" && /^[A-Za-z0-9_-]{1,128}$/.test(ledgerId)
    ? { ledgerId }
    : null;
};
