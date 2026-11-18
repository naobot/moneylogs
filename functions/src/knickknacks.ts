/**
 * Knick-knack finds: pure helpers for maybeFindKnickKnack. Mirrors the client catalog
 * (src/features/ledger/buddy/knickknacks/catalog.ts and seasons.ts); a root test keeps
 * the two in step. Dependency-free so it can be unit tested from the root Vitest run.
 *
 * A day has up to three rolls, one per slot: the first signed-in visit, the first logged
 * entry, and a visit in the evening. The odds come from luck (luck.ts). On a hit, rarer
 * items are picked less often.
 */

export type Season = "spring" | "summer" | "autumn" | "winter";
export type Hemisphere = "north" | "south";
/**
 * Milestone items are never found by chance (see milestones.ts), and neither are
 * special ones, which are granted by hand (scripts/grant-special.ts).
 */
export type Rarity = "super_common" | "common" | "rare" | "milestone" | "special";

/** How often each rarity is picked, relative to the others in season. */
export const RARITY_WEIGHTS: Record<Rarity, number> = {
  super_common: 6,
  common: 3,
  rare: 1,
  milestone: 0,
  special: 0,
};

export const KNICK_KNACK_FINDS = {
  acorn: { seasons: ["autumn"], rarity: "common" },
  pinecone: { seasons: ["autumn", "winter"], rarity: "common" },
  maple_leaf: { seasons: ["autumn"], rarity: "common" },
  apple: { seasons: ["autumn"], rarity: "rare" },
  persimmon: { seasons: ["autumn", "winter"], rarity: "rare" },
  osmanthus: { seasons: ["autumn"], rarity: "common" },
  chestnut: { seasons: ["autumn"], rarity: "common" },
  pine_branch: { seasons: ["winter"], rarity: "common" },
  holly: { seasons: ["winter"], rarity: "common" },
  snowdrop: { seasons: ["winter"], rarity: "rare" },
  cherry_blossom: { seasons: ["spring"], rarity: "rare" },
  tulip: { seasons: ["spring"], rarity: "common" },
  lilac: { seasons: ["spring"], rarity: "common" },
  daisy: { seasons: ["summer"], rarity: "common" },
  sunflower: { seasons: ["summer"], rarity: "common" },
  dragonfly: { seasons: ["summer"], rarity: "rare" },
  mushroom: { seasons: ["spring", "summer", "autumn", "winter"], rarity: "super_common" },
  pebble: { seasons: ["spring", "summer", "autumn", "winter"], rarity: "super_common" },
  feather: { seasons: ["spring", "summer", "autumn", "winter"], rarity: "super_common" },
  copper_coin: { seasons: [], rarity: "milestone" },
  silver_coin: { seasons: [], rarity: "milestone" },
  gold_coin: { seasons: [], rarity: "milestone" },
  extra_shiny_gold_coin: { seasons: [], rarity: "milestone" },
  heart_leaf: { seasons: [], rarity: "milestone" },
  paper_crane: { seasons: [], rarity: "milestone" },
  friendship_bracelet: { seasons: [], rarity: "milestone" },
  little_envelope: { seasons: [], rarity: "milestone" },
  mini_robot_charm: { seasons: [], rarity: "special" },
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

/** At or under this share of the pace budget counts as comfortably under (luck.ts). */
export const COMFORTABLY_UNDER = 0.6;
/**
 * A new day's rolls open only this long after the previous day's first roll, so hopping
 * timezones can't make extra days.
 */
export const MIN_DAY_GAP_MS = 12 * 3_600_000;

/** The three chances at a find each day. */
export type RollSlot = "visit" | "entry" | "evening";

/** users/{id}/buddy/rolls. `lastDay`/`lastAtMs` are from the one-roll-a-day version. */
export type RollMarker = {
  day?: string;
  dayStartMs?: number;
  slots?: string[];
  finds?: number;
  lastDay?: string;
  lastAtMs?: number;
};

export type RollDay = { day: string; dayStartMs: number; slots: string[]; finds: number };

/**
 * Today's rolls so far, or a fresh day. Null when a new day can't start yet: the local day
 * went backwards (a timezone change), or the previous day started too recently.
 */
export const rollDay = ({
  marker,
  today,
  now,
}: {
  marker?: RollMarker | null;
  today: string;
  now: number;
}): RollDay | null => {
  const fresh = { day: today, dayStartMs: now, slots: [], finds: 0 };
  const day = marker?.day ?? marker?.lastDay;
  const start = marker?.dayStartMs ?? marker?.lastAtMs;
  if (!day) return fresh;
  if (day === today) {
    // An old marker's one roll counts as today's entry roll.
    const slots = marker?.slots ?? (marker?.lastDay ? ["entry"] : []);
    return { day, dayStartMs: start ?? now, slots, finds: marker?.finds ?? 0 };
  }
  if (today < day) return null;
  if (typeof start === "number" && now - start < MIN_DAY_GAP_MS) return null;
  return fresh;
};

/**
 * The slot a check-in can roll: a logged entry has its own; a visit takes the visit slot,
 * or the evening one from EVENING_FROM_HOUR once the visit slot is spent.
 */
export const openSlot = (
  day: RollDay,
  { kind, hour }: { kind: "visit" | "entry"; hour: number },
): RollSlot | null => {
  const free = (slot: RollSlot) => !day.slots.includes(slot);
  if (kind === "entry") return free("entry") ? "entry" : null;
  if (free("visit")) return "visit";
  return hour >= EVENING_FROM_HOUR && free("evening") ? "evening" : null;
};

/** Whether a visit later today could still roll (the client asks again if so). */
export const visitRollsLeft = (day: RollDay | null): boolean =>
  !day || !day.slots.includes("visit") || !day.slots.includes("evening");

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
 * The evening roll opens at this hour: the same hour the buddy's evening check-in starts
 * (src/features/ledger/buddy/buddyCheckIn.ts).
 */
export const EVENING_FROM_HOUR = 17;

export const parseQuietDayRequest = (data: unknown): { ledgerId: string } | null => {
  const ledgerId = (data as { ledgerId?: unknown } | null)?.ledgerId;
  return typeof ledgerId === "string" && /^[A-Za-z0-9_-]{1,128}$/.test(ledgerId)
    ? { ledgerId }
    : null;
};
