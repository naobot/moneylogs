const storageKey = (id: string) => `ML__drawer_${id}`;

// Storage can throw (private mode, blocked site data) or be missing, so every access is
// guarded. A drawer's open state is only a convenience; losing it is harmless.
export const readDrawerOpen = (id: string): boolean | undefined => {
  try {
    const value = window.localStorage.getItem(storageKey(id));
    if (value === "1") return true;
    if (value === "0") return false;
  } catch {
    // ignore
  }
  return undefined;
};

export const writeDrawerOpen = (id: string, open: boolean) => {
  try {
    window.localStorage.setItem(storageKey(id), open ? "1" : "0");
  } catch {
    // ignore
  }
};
