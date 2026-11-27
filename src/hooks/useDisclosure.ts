import { useCallback, useState } from "react";
import { storage } from "@/platform";

/** Which disclosures are open, by id, on this device (like the display prefs). */
export const DISCLOSURES_KEY = "ML__disclosures";

const storedOpen = (id: string): boolean | undefined => {
  const all = storage.getJSON<Record<string, unknown>>(DISCLOSURES_KEY);
  const value = all && typeof all === "object" ? all[id] : undefined;
  return typeof value === "boolean" ? value : undefined;
};

const storeOpen = (id: string, open: boolean) => {
  const all = storage.getJSON<Record<string, boolean>>(DISCLOSURES_KEY);
  storage.set(
    DISCLOSURES_KEY,
    JSON.stringify({ ...(all && typeof all === "object" ? all : {}), [id]: open }),
  );
};

/**
 * Open state for a disclosure: remembered on this device under `id` when there is one,
 * else `defaultOpen` until the person toggles it.
 */
export const useDisclosure = (id: string | undefined, defaultOpen = false) => {
  const [open, setOpen] = useState(() => (id ? (storedOpen(id) ?? defaultOpen) : defaultOpen));
  const toggle = useCallback(() => {
    const next = !open;
    if (id) storeOpen(id, next);
    setOpen(next);
  }, [id, open]);
  return [open, toggle] as const;
};
