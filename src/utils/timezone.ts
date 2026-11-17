import dayjs from "@/utils/configuredDayjs";

/**
 * Returns the browser's timezone when it differs from the user's profile timezone at the
 * given moment, so posts made while travelling are labelled with the local zone.
 * Zones are compared by UTC offset (at `at`, so DST is respected) rather than by name,
 * so equivalent zones like America/Toronto and America/New_York don't trigger an override.
 */
export const getAutoPostTimezone = (
  profileTz: string | null | undefined,
  at: number,
  browserTz: string | null | undefined = dayjs.tz.guess(),
): string | null => {
  if (!profileTz || !browserTz || profileTz === browserTz) return null;

  try {
    const profileOffset = dayjs(at).tz(profileTz).utcOffset();
    const browserOffset = dayjs(at).tz(browserTz).utcOffset();
    return profileOffset === browserOffset ? null : browserTz;
  } catch {
    return null;
  }
};

/** "GMT+9", "GMT+5:30", "GMT-3:30", or "GMT" for UTC, at the given moment (DST-aware). */
export const utcOffsetLabel = (tz: string, at: number = Date.now()): string => {
  const minutes = dayjs(at).tz(tz).utcOffset();
  if (minutes === 0) return "GMT";
  const sign = minutes > 0 ? "+" : "-";
  const abs = Math.abs(minutes);
  const mins = abs % 60;
  return `GMT${sign}${Math.floor(abs / 60)}${mins ? `:${String(mins).padStart(2, "0")}` : ""}`;
};

/**
 * Short zone name for a time suffix: "PST", "EDT" where the browser has one, otherwise the
 * offset ("GMT+9").
 */
export const tzAbbrev = (tz: string, at: number = Date.now()): string => {
  try {
    const part = new Intl.DateTimeFormat("en-US", { timeZone: tz, timeZoneName: "short" })
      .formatToParts(at)
      .find((p) => p.type === "timeZoneName")?.value;
    if (part && !part.startsWith("GMT") && !part.startsWith("UTC")) return part;
  } catch {
    // Unknown zone: fall through to the offset, which dayjs may still resolve.
  }
  try {
    return utcOffsetLabel(tz, at);
  } catch {
    return tz;
  }
};

/** The city part of an IANA zone id: "America/Argentina/Buenos_Aires" → "Buenos Aires". */
export const cityFromZone = (tz: string): string => (tz.split("/").pop() ?? tz).replace(/_/g, " ");

/** "Kyoto · GMT+9": a travelling post's zone, by its picked place when there is one. */
export const postZoneLabel = (tz: string, place?: string | null, at?: number): string => {
  let offset = "";
  try {
    offset = ` · ${utcOffsetLabel(tz, at)}`;
  } catch {
    // Unknown zone: show just the name.
  }
  return `${place || cityFromZone(tz)}${offset}`;
};
