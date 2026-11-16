import { useCallback, useEffect, useRef, useState } from "react";

// How long the tab must have been hidden before a return reloads the app (or, when
// the person is mid-edit, checks for a new deploy instead). Tune here (3 hours).
export const AWAY_MS = 3 * 60 * 60 * 1000;

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

export type ReturnAction = "none" | "reload" | "check";

// Pure decision for a tab becoming visible again. A long-hidden tab reloads so it
// comes back with fresh data and the latest build. If a field still holds focus
// (browsers restore it on return) the person may have unsaved input, so we only
// check for a new build and let the banner offer the refresh.
export const decideReturnAction = ({
  hiddenMs,
  isEditing,
  awayMs = AWAY_MS,
}: {
  hiddenMs: number;
  isEditing: boolean;
  awayMs?: number;
}): ReturnAction => {
  if (hiddenMs < awayMs) return "none";
  return isEditing ? "check" : "reload";
};

const NON_TEXT_INPUTS = new Set([
  "button",
  "checkbox",
  "color",
  "file",
  "hidden",
  "image",
  "radio",
  "range",
  "reset",
  "submit",
]);

// True when focus sits in somewhere the person types (input, textarea, editable).
export const isEditableElement = (el: Element | null): boolean => {
  if (!el) return false;
  if (el instanceof HTMLTextAreaElement) return !el.readOnly && !el.disabled;
  if (el instanceof HTMLInputElement) {
    return !NON_TEXT_INPUTS.has(el.type) && !el.readOnly && !el.disabled;
  }
  return el instanceof HTMLElement && el.isContentEditable === true;
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
 * When the user returns to a tab hidden for >= AWAY_MS, reloads the app. If they
 * were mid-edit, it doesn't reload; instead it surfaces a prompt when a newer build
 * has been deployed, and the UI decides.
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

      const action = decideReturnAction({
        hiddenMs,
        isEditing: isEditableElement(document.activeElement),
      });
      if (action === "reload") {
        window.location.reload();
        return;
      }
      if (action !== "check" || !bootBuildId.current) return;

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
