import { useEffect } from "react";

import { useNavigationHeld } from "@/utils/navigationHold";

import "./NavigationHold.scss";

/**
 * While a call holds navigation (utils/navigationHold), a clear layer over the whole app
 * takes clicks, so nothing can be opened or pressed until it's back. Links reached from
 * the keyboard are stopped too, and a reload or tab close asks first. Mount once, at the
 * top of the app.
 */
export const NavigationHold = () => {
  const held = useNavigationHeld();

  useEffect(() => {
    if (!held) return;
    const stopLinks = (event: MouseEvent) => {
      if ((event.target as Element | null)?.closest?.("a[href]")) {
        event.preventDefault();
        event.stopPropagation();
      }
    };
    const askBeforeLeaving = (event: BeforeUnloadEvent) => event.preventDefault();
    document.addEventListener("click", stopLinks, true);
    window.addEventListener("beforeunload", askBeforeLeaving);
    return () => {
      document.removeEventListener("click", stopLinks, true);
      window.removeEventListener("beforeunload", askBeforeLeaving);
    };
  }, [held]);

  return held ? <div className="NavigationHold" aria-hidden="true" /> : null;
};

export default NavigationHold;
