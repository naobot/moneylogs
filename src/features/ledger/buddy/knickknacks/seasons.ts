/**
 * Seasons for knick-knack finds. The hemisphere comes from the user's stored timezone,
 * so an April in Sydney is autumn. Unknown or missing zones count as northern.
 */

export type Season = "spring" | "summer" | "autumn" | "winter";
export type Hemisphere = "north" | "south";

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

// Northern seasons by month, January first.
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
export const seasonOf = (month: number, hemisphere: Hemisphere = "north"): Season => {
  const shift = hemisphere === "south" ? 6 : 0;
  return NORTHERN[(month - 1 + shift) % 12];
};
