import { useEffect, useState } from "react";
import type { Dayjs } from "dayjs";

import dayjs from "@/utils/configuredDayjs";

export const DEFAULT_TICK_MS = 60_000;

/**
 * A clock that re-renders its consumer on an interval.
 *
 * Values derived from `dayjs()` inside a render or a useMemo freeze until something
 * unrelated triggers a re-render, so a tab left open sits on a stale answer — a group
 * whose end time has passed keeps showing as active, a countdown stops counting.
 * Reading `now` from here makes those values re-evaluate on their own.
 *
 * Also ticks when the tab becomes visible again: background intervals are throttled
 * (and suspended entirely when a device sleeps), so a tab returning after hours would
 * otherwise show a stale value until the next interval fires.
 */
export const useNow = (intervalMs: number = DEFAULT_TICK_MS): Dayjs => {
  const [now, setNow] = useState(() => dayjs());

  useEffect(() => {
    const tick = () => setNow(dayjs());

    const timer = setInterval(tick, intervalMs);
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") tick();
    };
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [intervalMs]);

  return now;
};

export default useNow;
