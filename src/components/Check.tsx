import cx from "classnames";
import { ReactNode } from "react";
import "./Check.scss";

type CheckProps = {
  checked: boolean;
  onChange: (checked: boolean) => void;
  /** The item: "15 nov · groceries", a friend's name. */
  children: ReactNode;
  disabled?: boolean;
  name?: string;
  value?: string;
  className?: string;
};

/**
 * A text-mode checkbox row (2026-11 audit), for choosing some items from a list (rows to
 * import, friends to invite): `[ ]` / `[x]` over a visually hidden native checkbox, which
 * keeps keyboard, screen-reader and form behaviour. Checked rows don't invert.
 */
const Check = ({
  checked,
  onChange,
  children,
  disabled = false,
  name,
  value,
  className,
}: CheckProps) => (
  <label className={cx("Check", { "Check--disabled": disabled }, className)}>
    <input
      type="checkbox"
      className="Check__input"
      checked={checked}
      disabled={disabled}
      name={name}
      value={value}
      onChange={(e) => onChange(e.target.checked)}
    />
    <strong className="Check__mark" aria-hidden="true">
      {checked ? "[x]" : "[ ]"}
    </strong>
    <span className="Check__label">{children}</span>
  </label>
);

export type RadioRowOption<Id extends string> = {
  id: Id;
  /** The answer, short: "save steadily". */
  label: ReactNode;
  /** The sentence that makes it worth a row of its own. */
  description?: ReactNode;
};

type RadioRowsProps<Id extends string> = {
  /** The native radios' group name. */
  name: string;
  /** Names the group: "How hard do you want to save?". */
  "aria-label": string;
  options: ReadonlyArray<RadioRowOption<Id>>;
  /** The chosen answer; none until the person picks. */
  value: Id | null;
  onChange: (id: Id) => void;
  className?: string;
};

/**
 * Radio rows (2026-11 audit): one of a few answers that each need a sentence (the budget
 * wizard's saving styles). Stacked rows in 1px frames that share their lines, `( )` /
 * `(•)` over hidden native radios; the chosen row inverts. For short options use
 * Segmented.
 */
export const RadioRows = <Id extends string>({
  name,
  "aria-label": ariaLabel,
  options,
  value,
  onChange,
  className,
}: RadioRowsProps<Id>) => (
  <div role="radiogroup" aria-label={ariaLabel} className={cx("RadioRows", className)}>
    {options.map((option) => {
      const chosen = option.id === value;
      return (
        <label
          key={option.id}
          className={cx("RadioRows__row", { "RadioRows__row--chosen": chosen })}
        >
          <input
            type="radio"
            className="Check__input"
            name={name}
            value={option.id}
            checked={chosen}
            onChange={() => onChange(option.id)}
          />
          <strong className="Check__mark" aria-hidden="true">
            {chosen ? "(•)" : "( )"}
          </strong>
          <span className="RadioRows__text">
            <span className="RadioRows__label">{option.label}</span>
            {option.description && (
              <span className="RadioRows__description">{option.description}</span>
            )}
          </span>
        </label>
      );
    })}
  </div>
);

export default Check;
