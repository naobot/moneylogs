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
