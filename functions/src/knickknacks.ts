/**
 * Knick-knack finds: pure helpers for maybeFindKnickKnack. Mirrors the client catalog
 * (src/features/ledger/buddy/knickknacks/catalog.ts and seasons.ts); a root test keeps
 * the two in step. Dependency-free so it can be unit tested from the root Vitest run.
 *
 * Logging an entry earns at most one roll a day. The odds tilt gently, and invisibly,
 * toward steady logging and staying on budget pace: from about one find a month to
 * about one every twelve days.
 */

export type Season = "spring" | "summer" | "autumn" | "winter";
export type Hemisphere = "north" | "south";

export const KNICK_KNACK_SEASONS = {
  acorn: ["autumn"],
  pinecone: ["autumn", "winter"],
  maple_leaf: ["autumn"],
  pine_branch: ["winter"],
  holly: ["winter"],
  snowdrop: ["winter"],
  cherry_blossom: ["spring"],
  tulip: ["spring"],
  lilac: ["spring"],
  daisy: ["summer"],
  sunflower: ["summer"],
  dragonfly: ["summer"],
} as const satisfies Record<string, readonly Season[]>;

export type KnickKnackId = keyof typeof KNICK_KNACK_SEASONS;

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
  return (Object.keys(KNICK_KNACK_SEASONS) as KnickKnackId[]).filter((id) =>
    (KNICK_KNACK_SEASONS[id] as readonly Season[]).includes(season),
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

export const BASE_CHANCE = 0.03;
export const STEADY_BONUS = 0.03;
export const ON_PACE_BONUS = 0.02;
/** Days with spending, out of the last 14, that count as fully steady. */
export const STEADY_DAYS = 10;
/** Rolls at least this far apart, so hopping timezones can't make a second "day". */
export const MIN_ROLL_GAP_MS = 20 * 3_600_000;

export const findChance = ({ loggedDays, onPace }: { loggedDays: number; onPace: boolean }) =>
  BASE_CHANCE +
  (Math.min(Math.max(loggedDays, 0), STEADY_DAYS) / STEADY_DAYS) * STEADY_BONUS +
  (onPace ? ON_PACE_BONUS : 0);

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
  return findable[Math.min(Math.floor(rand() * findable.length), findable.length - 1)];
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
