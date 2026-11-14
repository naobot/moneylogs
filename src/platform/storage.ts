/**
 * Device-local key/value storage for preferences, drafts, dismissed hints and short-lived
 * caches: never anything that must survive, which lives in Firestore.
 *
 * Backed by localStorage. In the Capacitor shell the WebView keeps localStorage for the
 * app's own origin, so the same store works there; this module is the one place to swap
 * it if that ever changes.
 *
 * Storage can be missing or throw (private mode, blocked site data, a full quota), so no
 * call here ever throws: reads fall back to null/undefined and writes report false.
 */
const backing = (): Storage | null => {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
};

export const storage = {
  get(key: string): string | null {
    try {
      return backing()?.getItem(key) ?? null;
    } catch {
      return null;
    }
  },

  set(key: string, value: string): boolean {
    try {
      const store = backing();
      if (!store) return false;
      store.setItem(key, value);
      return true;
    } catch {
      return false;
    }
  },

  remove(key: string): void {
    try {
      backing()?.removeItem(key);
    } catch {
      // ignore
    }
  },

  /** The parsed value, or undefined when it's missing or not valid JSON. */
  getJSON<T = unknown>(key: string): T | undefined {
    const raw = storage.get(key);
    if (raw === null) return undefined;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return undefined;
    }
  },

  setJSON(key: string, value: unknown): boolean {
    try {
      return storage.set(key, JSON.stringify(value));
    } catch {
      return false;
    }
  },
};
