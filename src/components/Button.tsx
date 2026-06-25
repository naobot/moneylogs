import React, { ForwardedRef, forwardRef } from "react";
import cx from "classnames";
import { Link } from "react-router-dom";
import Icon, { IconType } from "./Icon";

type ButtonProps = {
  text?: string;
  onClick?: () => void;
  disabled?: boolean;
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  buttonStyle?: "primary" | "primary-border" | "primary-border-lite";
  loading?: boolean;
  to?: string;
  className?: string;
  icon?: IconType;
  title?: string;
  isSelected?: boolean;
};

const Button = forwardRef(
  (
    {
      text,
      onClick = () => {},
      disabled = false,
      size = "md",
      buttonStyle = "primary",
      loading = false,
      to,
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
      "Button--active": isSelected,
      [`Button--size-${size}`]: size,
      [`Button--${buttonStyle}`]: buttonStyle,
      [className]: className,
    });

    const handleClick = (e: React.MouseEvent) => {
      e.preventDefault();
      onClick();
    };

    if (to) {
      return (
        <Link to={to} onClick={handleClick} className={sharedClassName} title={title} {...props}>
          {icon && <Icon type={icon} />}
          <strong>{text}</strong>
        </Link>
      );
    }

    return (
      <button
        ref={ref}
        onClick={handleClick}
        className={sharedClassName}
        disabled={disabled || loading}
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
