import React, { ForwardedRef, forwardRef } from "react";
import cx from "classnames";
import { Link } from "react-router-dom";
import Icon, { IconType } from "./Icon";

/**
 * One look per role, so it's never a per-screen choice:
 * - primary: the one committing action of a surface (Save, Join, Submit). 2px frame.
 * - secondary: any other word action (Cancel, Back, Load more). 1px frame.
 * - toggle: one option of a segmented choice. 1px frame, filled when `isSelected`.
 * - icon: icon-only chrome (nav icons, theme toggle). No frame.
 * Filled always means "selected"; emphasis between actions comes from frame weight.
 */
export type ButtonVariant = "primary" | "secondary" | "toggle" | "icon";

type ButtonProps = {
  text?: string;
  onClick?: () => void;
  disabled?: boolean;
  /** sm: inside a section, row or form. md: modal footers and page-level actions. */
  size?: "sm" | "md";
  variant?: ButtonVariant;
  loading?: boolean;
  to?: string;
  /** Router state for a `to` link, e.g. `{ view: "register" }` for /login. */
  state?: unknown;
  className?: string;
  icon?: IconType;
  title?: string;
  /** Toggles only: this option is the current one. */
  isSelected?: boolean;
  /** For icon-only buttons whose name should differ from `title`. */
  "aria-label"?: string;
};

const Button = forwardRef(
  (
    {
      text,
      onClick = () => {},
      disabled = false,
      size = "md",
      variant = "primary",
      loading = false,
      to,
      state,
      className = "",
      icon,
      title = text,
      isSelected = false,
      ...props
    }: ButtonProps,
    ref: ForwardedRef<HTMLButtonElement>,
  ) => {
    const sharedClassName = cx("Button", {
      "Button--disabled": disabled || loading,
      "Button--active": variant === "toggle" && isSelected,
      [`Button--size-${size}`]: size,
      [`Button--${variant}`]: variant,
      [className]: className,
    });

    if (to) {
      return (
        <Link
          to={to}
          state={state}
          onClick={onClick}
          className={sharedClassName}
          title={title}
          {...props}
        >
          {icon && <Icon type={icon} />}
          <strong>{text}</strong>
        </Link>
      );
    }

    const handleClick = (e: React.MouseEvent) => {
      e.preventDefault();
      onClick();
    };

    return (
      <button
        ref={ref}
        onClick={handleClick}
        className={sharedClassName}
        disabled={disabled || loading}
        aria-pressed={variant === "toggle" ? isSelected : undefined}
        title={title}
        {...props}
      >
        {icon && <Icon type={icon} />}
        <strong>{text}</strong>
      </button>
    );
  },
);

export default Button;
