import { ButtonHTMLAttributes } from "react";
import cx from "classnames";

type RowButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  /**
   * The label is a single symbol (‹ › ↑ ↓ ×) rather than a word: it keeps its own
   * case and is set in Hack instead of the pixel button face. Give it an aria-label.
   */
  glyph?: boolean;
};

/**
 * The small, hairline-framed action at the end of a list row or beside a stepper
 * ("manage", "budget", "this month", ‹ ›). Inverts on hover. For a page's primary
 * action use Button instead.
 */
export const RowButton = ({
  glyph = false,
  className,
  type = "button",
  ...props
}: RowButtonProps) => (
  <button
    type={type}
    className={cx("RowButton", { "RowButton--glyph": glyph }, className)}
    {...props}
  />
);

export default RowButton;
