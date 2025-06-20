import { useEffect } from "react"

export const useExternalLinkHandler = (containerRef: React.RefObject<HTMLElement>, dependencies: React.DependencyList = []) => {
  const isExternalLink = (href: string): boolean => {
    try {
      const url = new URL(href, window.location.href)
      return url.origin !== window.location.origin
    } catch {
      return false
    }
  }

  useEffect(() => {
    if (containerRef.current) {
      const links = containerRef.current.querySelectorAll('a[href]')
      links.forEach(link => {
        const href = link.getAttribute('href')
        if (href && isExternalLink(href)) {
          link.setAttribute('target', '_blank')
          link.setAttribute('rel', 'noopener noreferrer')
        }
      })
    }
  }, dependencies)
}