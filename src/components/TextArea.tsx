import cx from "classnames";
import { ReactNode, TextareaHTMLAttributes, useLayoutEffect, useRef } from "react";
import { FieldFrame } from "./Field";

type TextAreaProps = Omit<
  TextareaHTMLAttributes<HTMLTextAreaElement>,
  "id" | "className" | "rows" | "value"
> & {
  label: ReactNode;
  value: string;
  hint?: ReactNode;
  error?: ReactNode;
  /** Says "markdown ok" in the footer, for posts and comments. */
  markdown?: boolean;
  /**
   * When to count characters against `maxLength`: always (posts), or only past 80% of
   * the limit (comments, where the count would be noise).
   */
  counter?: "always" | "near-limit";
  className?: string;
};

const MIN_ROWS = 3;
const MAX_ROWS = 8;

/**
 * A text area (2026-11 audit): the text field's dashed frame, growing from 3 to 8 rows
 * and then scrolling, with no resize handle. A footer strip inside the frame says
 * "markdown ok" and counts characters.
 */
const TextArea = ({
  label,
  value,
  hint,
  error,
  markdown = false,
  counter = "always",
  maxLength,
  disabled,
  className,
  ...textarea
}: TextAreaProps) => {
  const ref = useRef<HTMLTextAreaElement>(null);

  // Grow with the text: measure from the shortest height, then clamp to 3–8 lines.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const style = getComputedStyle(el);
    const line = parseFloat(style.lineHeight) || parseFloat(style.fontSize) * 1.5;
    const padding = parseFloat(style.paddingTop) + parseFloat(style.paddingBottom);
    el.style.height = "auto";
    const wanted = el.scrollHeight;
    const min = MIN_ROWS * line + padding;
    const max = MAX_ROWS * line + padding;
    el.style.height = `${Math.min(Math.max(wanted, min), max)}px`;
    el.style.overflowY = wanted > max ? "auto" : "hidden";
  }, [value]);

  const showCount =
    maxLength !== undefined && (counter === "always" || value.length >= maxLength * 0.8);
  const footer = markdown || showCount;

  return (
    <FieldFrame label={label} hint={hint} error={error} disabled={disabled} className={className}>
      {({ inputId, describedBy }) => (
        <div className="Field__box Field__box--area">
          <textarea
            ref={ref}
            id={inputId}
            className={cx("Field__input", "Field__textarea")}
            rows={MIN_ROWS}
            value={value}
            maxLength={maxLength}
            disabled={disabled}
            aria-invalid={error ? true : undefined}
            aria-describedby={describedBy}
            {...textarea}
          />
          {footer && (
            <div className="Field__footer">
              <span>{markdown && "markdown ok"}</span>
              {showCount && (
                <span
                  className={cx("Field__count", {
                    "Field__count--full": value.length >= maxLength!,
                  })}
                >
                  {value.length} / {maxLength}
                </span>
              )}
            </div>
          )}
        </div>
      )}
    </FieldFrame>
  );
};

export default TextArea;
