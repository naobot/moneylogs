import { useEffect, useRef } from "react";

import { useCurrentUser } from "@/contexts";
import { useUserQuery } from "@/hooks/useUserQuery";
import {
  markerMillis,
  shouldStampVisit,
  STAMP_ON_LEAVE_MIN_GAP_MS,
  STAMP_ON_OPEN_MIN_GAP_MS,
} from "@/utils/logActivity";

/**
 * Stamps `logLastViewedAt.<logId>` on the user doc when they open a log, and again when
 * they leave it (route change or tab hidden), so posts that arrived while they were
 * looking don't show as new on Home. Pass undefined to do nothing (e.g. spectators, or
 * while the log is still loading).
 */
export const useStampLogVisit = (logId: string | undefined) => {
  const { user } = useCurrentUser();
  const { stampLogVisitFn } = useUserQuery();
  const userDocId = user?.id;

  // Read the latest values inside the effect without re-running it on every user update
  // (the stamp itself updates the user doc, which would otherwise loop).
  const storedMs = markerMillis(logId ? user?.logLastViewedAt?.[logId] : undefined);
  const latest = useRef({ storedMs, stampFn: stampLogVisitFn });
  useEffect(() => {
    latest.current = { storedMs, stampFn: stampLogVisitFn };
  });

  // Stamps this tab wrote, per log. Outlives effect re-runs so StrictMode remounts and
  // quick in-and-out navigation don't each write.
  const lastWrites = useRef<Record<string, number>>({});

  useEffect(() => {
    if (!logId || !userDocId) return;

    const stamp = (minGapMs: number) => {
      const { storedMs, stampFn } = latest.current;
      const known = [storedMs, lastWrites.current[logId]].filter(
        (ms): ms is number => typeof ms === "number",
      );
      // A pending write (null) counts as "just stamped".
      const lastStampMs = storedMs === null ? null : known.length ? Math.max(...known) : undefined;
      const now = Date.now();
      if (!shouldStampVisit(lastStampMs, now, minGapMs)) return;
      lastWrites.current[logId] = now;
      stampFn({ userId: userDocId, logId }).catch((err) =>
        console.error(`Failed to record visit to ${logId}:`, err),
      );
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden") stamp(STAMP_ON_LEAVE_MIN_GAP_MS);
    };

    stamp(STAMP_ON_OPEN_MIN_GAP_MS);
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      stamp(STAMP_ON_LEAVE_MIN_GAP_MS);
    };
  }, [logId, userDocId]);
};

export default useStampLogVisit;
