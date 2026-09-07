import { useEffect } from "react";

export const useDisableScroll = (isActive = true) => {
  useEffect(() => {
    const disabledPreviously = document
      ?.querySelector("html")
      ?.classList.contains("disable-scroll");

    if (isActive) {
      document?.querySelector("html")?.classList.add("disable-scroll");
    }

    return () => {
      if (!disabledPreviously && isActive) {
        document?.querySelector("html")?.classList.remove("disable-scroll");
      }
    };
  }, [isActive]);
};
