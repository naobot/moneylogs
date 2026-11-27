import cx from "classnames";
import { ReactNode, useId } from "react";
import "./Switch.scss";

type SwitchProps = {
  /** What it turns on or off (lowercase copy): "colour charts", "daily digest". */
  label: ReactNode;
  /** One caption line under the label: what on means, or why it's off. */
  hint?: ReactNode;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  className?: string;
};

/**
 * A setting that is on or off and saves at once (2026-11 audit): a square 52×26 track
 * with an 18px knob, inverted when on. The whole row, label and all, is the hit area.
 * For choosing some items from a list use Check; for short options, Segmented.
 */
const Switch = ({ label, hint, checked, onChange, disabled = false, className }: SwitchProps) => {
  const labelId = useId();
  const hintId = useId();
  return (
    <label className={cx("Switch", { "Switch--disabled": disabled }, className)}>
      <span className="Switch__text">
        <span id={labelId} className="Switch__label">
          {label}
        </span>
        {hint && (
          <span id={hintId} className="Switch__hint">
            {hint}
          </span>
        )}
      </span>
      <button
        type="button"
        role="switch"
        className="Switch__track"
        aria-checked={checked}
        aria-labelledby={labelId}
        aria-describedby={hint ? hintId : undefined}
        disabled={disabled}
        onClick={() => onChange(!checked)}
      >
        <span className="Switch__knob" aria-hidden="true" />
      </button>
    </label>
  );
};

export default Switch;
