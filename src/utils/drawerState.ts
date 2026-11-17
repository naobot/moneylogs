import { storage } from "@/platform";

const storageKey = (id: string) => `ML__drawer_${id}`;

// A drawer's open state is only a convenience; losing it is harmless.
export const readDrawerOpen = (id: string): boolean | undefined => {
  const value = storage.get(storageKey(id));
  if (value === "1") return true;
  if (value === "0") return false;
  return undefined;
};

export const writeDrawerOpen = (id: string, open: boolean) => {
  storage.set(storageKey(id), open ? "1" : "0");
};
