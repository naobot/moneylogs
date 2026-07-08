import { useCallback, useEffect, useRef, useState } from "react";

// How long the tab must have been hidden before a return checks for a new deploy.
// Tune here (4 hours). Kept generous so a brief step-away never prompts.
const AWAY_MS = 4 * 60 * 60 * 1000;

const VERSION_URL = "/version.json";

type VersionInfo = { buildId?: string };

// Pure decision: prompt only when we know the build we booted with, a newer build
// is deployed, and the tab has been away long enough to be worth interrupting.
export const shouldPromptUpdate = ({
  bootBuildId,
  fetchedBuildId,
  hiddenMs,
  awayMs = AWAY_MS,
}: {
  bootBuildId: string | null;
  fetchedBuildId: string | null | undefined;
  hiddenMs: number;
  awayMs?: number;
}): boolean => {
  if (!bootBuildId || !fetchedBuildId) return false;
  if (hiddenMs < awayMs) return false;
  return fetchedBuildId !== bootBuildId;
};

const fetchBuildId = async (): Promise<string | null> => {
  try {
    const res = await fetch(`${VERSION_URL}?ts=${Date.now()}`, { cache: "no-store" });
    if (!res.ok) return null;
    const data = (await res.json()) as VersionInfo;
    return data.buildId ?? null;
  } catch {
    return null;
  }
};

/**
 * Surfaces a prompt when the user returns to a long-hidden tab (>= AWAY_MS) and a
 * newer app build has been deployed. Never reloads on its own — the UI decides.
 */
export const useAppVersionRefresh = () => {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const bootBuildId = useRef<string | null>(null);
  const hiddenAt = useRef<number | null>(null);

  useEffect(() => {
    let cancelled = false;

    // Record the build this tab is running. If it can't be fetched (dev/offline),
    // the feature simply stays dormant.
    void fetchBuildId().then((id) => {
      if (!cancelled) bootBuildId.current = id;
    });

    const onVisibilityChange = () => {
      if (document.hidden) {
        hiddenAt.current = Date.now();
        return;
      }

      const hiddenMs = hiddenAt.current ? Date.now() - hiddenAt.current : 0;
      hiddenAt.current = null;
      if (!bootBuildId.current || hiddenMs < AWAY_MS) return;

      void fetchBuildId().then((fetchedBuildId) => {
        if (cancelled) return;
        if (shouldPromptUpdate({ bootBuildId: bootBuildId.current, fetchedBuildId, hiddenMs })) {
          setUpdateAvailable(true);
        }
      });
    };

    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, []);

  const refresh = useCallback(() => {
    window.location.reload();
  }, []);

  return { updateAvailable, refresh };
};
