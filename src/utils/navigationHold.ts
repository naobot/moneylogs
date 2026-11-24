import { useSyncExternalStore } from "react";

/**
 * Holding the person on this page while a call that belongs to it is in flight, so its
 * result (a confirmation, a buddy cheer, an error toast) doesn't land on whatever page
 * they clicked through to. While anything holds, NavigationHold blocks clicks and links,
 * and the Android back button waits. Keep holds to short calls: the page is frozen while
 * one is out.
 */

let holds = 0;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((listener) => listener());

/** Hold navigation until the returned release is called (calling it twice is harmless). */
export const holdNavigation = (): (() => void) => {
  holds += 1;
  emit();
  let released = false;
  return () => {
    if (released) return;
    released = true;
    holds -= 1;
    emit();
  };
};

export const isNavigationHeld = (): boolean => holds > 0;

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

export const useNavigationHeld = (): boolean => useSyncExternalStore(subscribe, isNavigationHeld);

/** Runs `task` with navigation held until it settles, whether it succeeds or fails. */
export const whileHoldingNavigation = async <T>(task: () => Promise<T>): Promise<T> => {
  const release = holdNavigation();
  try {
    return await task();
  } finally {
    release();
  }
};
