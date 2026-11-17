import { useEffect, useState } from "react";

import { buildPlaceIndex, CityData, PlaceIndex } from "@/utils/citySearch";
import { reportError } from "@/utils/reportError";

let indexPromise: Promise<PlaceIndex> | null = null;

/**
 * The place list is ~1 MB, so it's its own lazily loaded chunk, fetched the first time a
 * picker mounts and shared after that. A failed load is forgotten so the next try refetches.
 */
export const loadPlaceIndex = (): Promise<PlaceIndex> => {
  indexPromise ??= import("@/data/cities.json")
    .then((mod) => buildPlaceIndex(mod.default as unknown as CityData))
    .catch((err: unknown) => {
      indexPromise = null;
      throw err;
    });
  return indexPromise;
};

export type PlaceIndexState =
  | { status: "loading"; index: null }
  | { status: "ready"; index: PlaceIndex }
  | { status: "failed"; index: null };

export const usePlaceIndex = (): PlaceIndexState => {
  const [state, setState] = useState<PlaceIndexState>({ status: "loading", index: null });

  useEffect(() => {
    let cancelled = false;
    loadPlaceIndex()
      .then((index) => {
        if (!cancelled) setState({ status: "ready", index });
      })
      .catch((err: unknown) => {
        // Zone names still work without the city list, so this is a warning.
        reportError(err, { feature: "profile", action: "load_places", level: "warning" });
        if (!cancelled) setState({ status: "failed", index: null });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return state;
};
