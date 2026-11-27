import cx from "classnames";
import { InputHTMLAttributes, ReactNode, useId } from "react";
import "./Field.scss";

type FieldFrameProps = {
  /** Always visible, above the box: never a placeholder standing in for it. */
  label: ReactNode;
  /** One caption line under the box. */
  hint?: ReactNode;
  /** What's wrong, in a sentence; shown instead of the hint with a `!`, frame heavy. */
  error?: ReactNode;
  disabled?: boolean;
  className?: string;
  /** The control, given the ids it should point at. */
  children: (ids: { inputId: string; describedBy: string | undefined }) => ReactNode;
};

/**
 * What every form control shares (2026-11 audit): the label above in caption, the box,
 * and a hint or a `!` error under it. Error is a heavier frame and the message, never a
 * colour.
 */
export const FieldFrame = ({
  label,
  hint,
  error,
  disabled = false,
  className,
  children,
}: FieldFrameProps) => {
  const inputId = useId();
  const noteId = useId();
  const note = error ?? hint;
  return (
    <div
      className={cx("Field", { "Field--invalid": !!error, "Field--disabled": disabled }, className)}
    >
      <label htmlFor={inputId} className="Field__label">
        {label}
      </label>
      {children({ inputId, describedBy: note ? noteId : undefined })}
      {error ? (
        <p id={noteId} className="Field__error">
          <strong aria-hidden="true">! </strong>
          {error}
        </p>
      ) : (
        hint && (
          <p id={noteId} className="Field__hint">
            {hint}
          </p>
        )
      )}
    </div>
  );
};

type FieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, "id" | "className"> & {
  label: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  className?: string;
};

/** Native inputs you pick from rather than type into: drawn solid, like a select. */
const CHOSEN_TYPES = new Set(["date", "time", "datetime-local", "month", "week"]);

/**
 * A text field (2026-11 audit): a 44px box on sheet with a dashed hairline (dashed
 * means you type), solid and 2px while focused. Dates and times are chosen, so their
 * box is solid. For in-place edits (a title, a note) use `.LineInput`.
 */
const Field = ({
  label,
  hint,
  error,
  disabled,
  className,
  type = "text",
  ...input
}: FieldProps) => (
  <FieldFrame label={label} hint={hint} error={error} disabled={disabled} className={className}>
    {({ inputId, describedBy }) => (
      <span className={cx("Field__box", { "Field__box--chosen": CHOSEN_TYPES.has(type) })}>
        <input
          id={inputId}
          type={type}
          className="Field__input"
          disabled={disabled}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          {...input}
        />
      </span>
    )}
  </FieldFrame>
);

export default Field;
