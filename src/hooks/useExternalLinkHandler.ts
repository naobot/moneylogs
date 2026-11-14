import { useEffect } from "react";
import { isExternalUrl } from "@/platform";

export const useExternalLinkHandler = (
  containerRef: React.RefObject<HTMLElement>,
  dependencies: React.DependencyList = [],
) => {
  useEffect(() => {
    if (containerRef.current) {
      const links = containerRef.current.querySelectorAll("a[href]");
      links.forEach((link) => {
        const href = link.getAttribute("href");
        if (href && isExternalUrl(href)) {
          link.setAttribute("target", "_blank");
          link.setAttribute("rel", "noopener noreferrer");
        }
      });
    }
  }, dependencies);
};
