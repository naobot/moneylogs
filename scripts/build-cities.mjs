// Builds src/data/cities.json, the place list behind PlacePicker, from GeoNames.
//
// Data: GeoNames (https://www.geonames.org), CC BY 4.0. Credited on the About page.
// Download into a scratch folder, then pass the three files:
//   https://download.geonames.org/export/dump/cities15000.zip   (unzip → cities15000.txt)
//   https://download.geonames.org/export/dump/admin1CodesASCII.txt
//   https://download.geonames.org/export/dump/countryInfo.txt
//
// Usage: node scripts/build-cities.mjs <cities15000.txt> <admin1CodesASCII.txt> <countryInfo.txt>
//
// Output shape (kept compact; the app lazy-loads it as its own chunk):
//   { v: 1, tz: string[], regions: string[], countries: { [code]: name },
//     rows: [name, countryCode, regionIndex (-1 when unknown), tzIndex][] }
// No ASCII-name column: the app folds accents itself (see normalise in citySearch.ts).
// Rows are sorted by population, largest first, and search breaks ties by row order, so
// the population itself isn't shipped.

import { readFileSync, writeFileSync } from "node:fs";

const [citiesPath, admin1Path, countryPath] = process.argv.slice(2);
if (!citiesPath || !admin1Path || !countryPath) {
  console.error(
    "Usage: node scripts/build-cities.mjs <cities15000.txt> <admin1CodesASCII.txt> <countryInfo.txt>",
  );
  process.exit(1);
}

const lines = (path) =>
  readFileSync(path, "utf8")
    .split("\n")
    .filter((l) => l && !l.startsWith("#"))
    .map((l) => l.split("\t"));

const countries = {};
for (const cols of lines(countryPath)) countries[cols[0]] = cols[4];

const admin1 = new Map();
for (const [code, name] of lines(admin1Path)) admin1.set(code, name);

// Zones this runtime's ICU can't resolve would fail in dayjs.tz, so leave those places out.
// (Not Intl.supportedValuesOf: it lists canonical names only, e.g. Asia/Calcutta not Kolkata.)
const zoneOk = new Map();
const isKnownZone = (zone) => {
  if (!zoneOk.has(zone)) {
    try {
      new Intl.DateTimeFormat("en", { timeZone: zone });
      zoneOk.set(zone, true);
    } catch {
      zoneOk.set(zone, false);
    }
  }
  return zoneOk.get(zone);
};
const tz = [];
const tzIndex = new Map();
const regions = [];
const regionIndex = new Map();
const indexOf = (list, index, value) => {
  if (!index.has(value)) {
    index.set(value, list.length);
    list.push(value);
  }
  return index.get(value);
};
const rows = [];
let skipped = 0;

for (const cols of lines(citiesPath)) {
  const name = cols[1];
  const countryCode = cols[8];
  const zone = cols[17];
  const population = Number(cols[14]) || 0;
  if (!zone || !isKnownZone(zone)) {
    skipped++;
    continue;
  }
  const region = admin1.get(`${countryCode}.${cols[10]}`);
  rows.push([
    name,
    countryCode,
    region ? indexOf(regions, regionIndex, region) : -1,
    indexOf(tz, tzIndex, zone),
    population,
  ]);
}

rows.sort((a, b) => b[4] - a[4]);
for (const row of rows) row.pop();

const out = new URL("../src/data/cities.json", import.meta.url);
writeFileSync(out, JSON.stringify({ v: 1, tz, regions, countries, rows }));
console.log(
  `Wrote ${rows.length} places in ${tz.length} zones (${skipped} skipped) to ${out.pathname}`,
);
