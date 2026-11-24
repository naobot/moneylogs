import "./LoadingDots.scss";

/**
 * The "…" of a wait, typing itself out one dot at a time (like a terminal cursor) so a
 * wait reads as working, not frozen. It keeps three dots' width, so nothing shifts.
 *
 * Alone, it says `label` ("loading") to screen readers. After words that already say
 * what's happening ("loading friends", "deleting your account"), pass `label=""`.
 */
export const LoadingDots = ({ label = "loading" }: { label?: string }) => (
  <span className="LoadingDots">
    <span className="LoadingDots__dots" aria-hidden="true">
      ...
    </span>
    {label && <span className="sr-only">{label}</span>}
  </span>
);

export default LoadingDots;
