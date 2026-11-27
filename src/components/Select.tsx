import cx from "classnames";
import { ReactNode, SelectHTMLAttributes } from "react";
import { FieldFrame } from "./Field";

export type SelectOption = { value: string; label: string };

type SelectProps = Omit<
  SelectHTMLAttributes<HTMLSelectElement>,
  "id" | "className" | "value" | "onChange"
> & {
  label: ReactNode;
  value: string;
  onChange: (value: string) => void;
  options: ReadonlyArray<SelectOption>;
  /** Shown, muted, while nothing is chosen ("pick a category…"). */
  placeholder?: string;
  hint?: ReactNode;
  error?: ReactNode;
  className?: string;
};

/**
 * A boxed select (2026-11 audit): a real <select> with appearance: none in a 44px solid
 * frame (solid: you choose, not type) with a 40px ▾ cell. Phones keep their own picker;
 * only the closed control is drawn. While it's focused or open the frame goes 2px and
 * the cell inverts (▴).
 */
const Select = ({
  label,
  value,
  onChange,
  options,
  placeholder,
  hint,
  error,
  disabled,
  className,
  ...select
}: SelectProps) => (
  <FieldFrame label={label} hint={hint} error={error} disabled={disabled} className={className}>
    {({ inputId, describedBy }) => (
      <span
        className={cx("Field__box", "Field__box--chosen", "Select", { "Select--empty": !value })}
      >
        <select
          id={inputId}
          className="Field__input Select__native"
          value={value}
          disabled={disabled}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          onChange={(e) => onChange(e.target.value)}
          {...select}
        >
          {placeholder !== undefined && (
            <option value="" disabled>
              {placeholder}
            </option>
          )}
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <span className="Select__cell" aria-hidden="true" />
      </span>
    )}
  </FieldFrame>
);

type InlineSelectProps = Omit<
  SelectHTMLAttributes<HTMLSelectElement>,
  "className" | "value" | "onChange"
> & {
  value: string;
  onChange: (value: string) => void;
  options: ReadonlyArray<SelectOption>;
  /** There's no visible label inline, so the select needs a name. */
  "aria-label": string;
  className?: string;
};

/**
 * An inline select for headers and rows (`JPY ▾`, `inbox only ▾`): bold text on a 1px
 * solid underline, in a 44px hit area.
 */
export const InlineSelect = ({
  value,
  onChange,
  options,
  className,
  ...select
}: InlineSelectProps) => (
  <span className={cx("InlineSelect", className)}>
    <select
      className="InlineSelect__native"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      {...select}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  </span>
);

export default Select;
