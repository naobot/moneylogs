import cx from "classnames";
import { ElementType, MouseEventHandler, ReactNode } from "react";
import "./SectionLabel.scss";

type SectionLabelProps = {
  /** The section's name (lowercase copy). User content goes in `.keep-case`. */
  children: ReactNode;
  /** A muted count after the name: "new · 3". */
  count?: ReactNode;
  /** What sits at the right: a day's total, or a SectionLabel.Action. */
  aside?: ReactNode;
  /**
   * `today`: the one day header per list that keeps the black bar (the inversion
   * budget's first exception); everything under it is the past.
   */
  variant?: "default" | "today";
  /** The heading level, so the page's outline stays right. */
  as?: ElementType;
  className?: string;
};

/**
 * How sections are split on the ground (2026-11 audit), instead of boxes or inverted
 * strips: a bold 13px label on a 1px rule, with an optional muted count, and a total or
 * a 44px text action at the right. A day header is one too, carrying the day's total.
 */
const SectionLabel = ({
  children,
  count,
  aside,
  variant = "default",
  as: Heading = "h2",
  className,
}: SectionLabelProps) => (
  <div className={cx("SectionLabel", { "SectionLabel--today": variant === "today" }, className)}>
    <Heading className="SectionLabel__name">
      {children}
      {count !== undefined && count !== null && (
        <span className="SectionLabel__count"> · {count}</span>
      )}
    </Heading>
    {aside && <div className="SectionLabel__aside">{aside}</div>}
  </div>
);

type SectionLabelActionProps = {
  children: ReactNode;
  onClick?: MouseEventHandler<HTMLButtonElement>;
  "aria-label"?: string;
  "aria-expanded"?: boolean;
};

/** A section's one text action ("edit", "manage", "see all 9"): caps, 44px tall. */
const SectionLabelAction = ({ children, onClick, ...aria }: SectionLabelActionProps) => (
  <button type="button" className="SectionLabel__action" onClick={onClick} {...aria}>
    {children}
  </button>
);

SectionLabel.Action = SectionLabelAction;

export default SectionLabel;
