/**
 * Search over the bundled GeoNames place list (src/data/cities.json, built by
 * scripts/build-cities.mjs) so people can find their city and get its IANA timezone.
 * Pure functions: PlacePicker does the lazy loading.
 */

/** Raw shape of src/data/cities.json. Rows are sorted by population, largest first. */
export type CityData = {
  v: 1;
  tz: string[];
  regions: string[];
  countries: Record<string, string>;
  /** [name, countryCode, regionIndex (-1 = unknown), tzIndex] */
  rows: [string, string, number, number][];
};

export type Place = {
  /** "city" comes from GeoNames; "zone" is a bare IANA zone, the fallback for small towns. */
  kind: "city" | "zone";
  /** City name, or the zone id for a zone ("Europe/Paris"). */
  name: string;
  region?: string;
  country?: string;
  timezone: string;
};

export type PlaceIndex = {
  places: Place[];
  /** normalise(place.name), parallel to places. */
  keys: string[];
  /** normalise(region + " " + country + " " + countryCode), parallel to places. */
  qualifiers: string[];
  zones: { zone: string; key: string }[];
};

// Letters that NFD doesn't decompose into a base letter + accent.
const FOLDS: Record<string, string> = {
  ß: "ss",
  æ: "ae",
  œ: "oe",
  ø: "o",
  ł: "l",
  đ: "d",
  ð: "d",
  þ: "th",
  ı: "i",
};

/**
 * Lowercase, strip accents and apostrophes, and turn separators into single spaces, so
 * "zurich" finds "Zürich", "xian" finds "Xi’an" and "new-york" finds "New York".
 */
export const normalise = (s: string): string =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[ßæœøłđðþı]/g, (c) => FOLDS[c] ?? c)
    .replace(/['’‘`]/g, "")
    .replace(/[\s\-_/.]+/g, " ")
    .trim();

/** IANA zones this browser knows, plus UTC (which supportedValuesOf leaves out). */
const listZones = (): string[] => {
  const supported = (
    Intl as { supportedValuesOf?: (key: "timeZone") => string[] }
  ).supportedValuesOf?.("timeZone");
  return Array.from(new Set(["UTC", ...(supported ?? [])]));
};

export const buildPlaceIndex = (data: CityData, zones: string[] = listZones()): PlaceIndex => {
  const places: Place[] = [];
  const keys: string[] = [];
  const qualifiers: string[] = [];
  for (const [name, countryCode, regionIdx, tzIdx] of data.rows) {
    const region = regionIdx >= 0 ? data.regions[regionIdx] : undefined;
    const country = data.countries[countryCode] ?? countryCode;
    places.push({ kind: "city", name, region, country, timezone: data.tz[tzIdx] });
    keys.push(normalise(name));
    qualifiers.push(normalise(`${region ?? ""} ${country} ${countryCode}`));
  }
  return {
    places,
    keys,
    qualifiers,
    zones: zones.map((zone) => ({ zone, key: normalise(zone) })),
  };
};

/** 0 = exact, 1 = prefix, 2 = a later word starts with it, 3 = anywhere inside; -1 = none. */
const matchRank = (key: string, q: string): number => {
  if (key === q) return 0;
  if (key.startsWith(q)) return 1;
  if (key.includes(` ${q}`)) return 2;
  if (q.length >= 3 && key.includes(q)) return 3;
  return -1;
};

/** Every word of the qualifier must start a word in the place's region/country. */
const matchesQualifier = (qualifierKey: string, qualifier: string): boolean => {
  const words = ` ${qualifierKey}`;
  return qualifier.split(" ").every((w) => words.includes(` ${w}`));
};

/**
 * Best places for what the user typed, best first: exact names, then prefixes, then
 * word prefixes, then substrings, with bigger places first within each. "Springfield, il"
 * narrows by region, country or country code after the comma. IANA zones ("utc",
 * "europe/paris") fill any slots left, for towns too small to be in the list.
 */
export const searchPlaces = (index: PlaceIndex, query: string, limit = 8): Place[] => {
  const [rawName, ...rest] = query.split(",");
  const q = normalise(rawName);
  const qualifier = normalise(rest.join(" "));
  if (!q) return [];

  // Buckets by rank; rows are already in population order, so each bucket stays sorted.
  const buckets: Place[][] = [[], [], [], []];
  for (let i = 0; i < index.places.length; i++) {
    const rank = matchRank(index.keys[i], q);
    if (rank < 0 || buckets[rank].length >= limit) continue;
    if (qualifier && !matchesQualifier(index.qualifiers[i], qualifier)) continue;
    buckets[rank].push(index.places[i]);
    if (buckets[0].length >= limit) break;
  }
  const results = buckets.flat().slice(0, limit);

  if (results.length < limit && !qualifier) {
    for (const { zone, key } of index.zones) {
      if (results.length >= limit) break;
      if (matchRank(key, q) >= 0) {
        results.push({ kind: "zone", name: zone, timezone: zone });
      }
    }
  }
  return results;
};

/** How a picked place reads in the picker and as the display-location suggestion. */
export const placeLabel = (place: Place): string =>
  place.kind === "city" && place.country ? `${place.name}, ${place.country}` : place.name;

/** Second line in the suggestion list, to tell same-named places apart. */
export const placeDetail = (place: Place): string =>
  place.kind === "city" ? [place.region, place.country].filter(Boolean).join(", ") : "timezone";

/**
 * What the display location should become after a place is picked. It follows the
 * picked place while it's blank or still the suggestion we last filled in, and stays
 * put once the user has written their own.
 */
export const nextDisplayLocation = (
  current: string,
  lastSuggested: string | undefined,
  picked: Place,
): string => {
  if (picked.kind !== "city") return current;
  if (!current.trim() || current === lastSuggested) return placeLabel(picked);
  return current;
};
