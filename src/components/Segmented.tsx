import cx from "classnames";
import { ReactNode } from "react";
import { Link } from "react-router-dom";
import "./Segmented.scss";

export type SegmentedOption<Id extends string> = {
  id: Id;
  label: ReactNode;
  /** A link instead of a button, for a choice that is a page (entries | stats). */
  to?: string;
  /** When the label alone doesn't say it (S M L). */
  ariaLabel?: string;
};

type SegmentedProps<Id extends string> = {
  options: ReadonlyArray<SegmentedOption<Id>>;
  value: Id;
  /** Called with a button option's id (link options navigate instead). */
  onChange?: (id: Id) => void;
  /** Names the group: "View", "Period", "Text size". */
  "aria-label": string;
  /**
   * primary: the page's main choice (entries | stats), 2px frame, 40px, caps.
   * sub: a smaller choice inside a section (week | month | year), 1px frame, 36px.
   */
  weight?: "primary" | "sub";
  /** Sits flush under a TitleBar, sharing its bottom line. */
  flush?: boolean;
  className?: string;
};

/**
 * One of 2–4 short options (2026-11 audit): one joined control, segments split by its
 * line, the chosen one inverted. More options want a select; on/off wants a switch.
 */
const Segmented = <Id extends string>({
  options,
  value,
  onChange,
  "aria-label": ariaLabel,
  weight = "primary",
  flush = false,
  className,
}: SegmentedProps<Id>) => (
  <div
    role="group"
    aria-label={ariaLabel}
    className={cx("Segmented", `Segmented--${weight}`, { "Segmented--flush": flush }, className)}
    style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
  >
    {options.map((option) => {
      const selected = option.id === value;
      const shared = {
        className: cx("Segmented__option", { "Segmented__option--selected": selected }),
        "aria-label": option.ariaLabel,
      };
      return option.to ? (
        <Link
          key={option.id}
          to={option.to}
          aria-current={selected ? "page" : undefined}
          onClick={() => onChange?.(option.id)}
          {...shared}
        >
          {option.label}
        </Link>
      ) : (
        <button
          key={option.id}
          type="button"
          aria-pressed={selected}
          onClick={() => {
            if (!selected) onChange?.(option.id);
          }}
          {...shared}
        >
          {option.label}
        </button>
      );
    })}
  </div>
);

export default Segmented;
