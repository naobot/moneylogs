import cx from "classnames";
import { MouseEventHandler, useMemo } from "react";

type IconProps = {
  type: IconType;
  size?: number;
  fill?: string;
  onClick?: MouseEventHandler<HTMLDivElement>;
};

export type IconType =
  | "home"
  | "question"
  | "warning"
  | "notification"
  | "clock"
  | "exit"
  | "location"
  | "dollar"
  | "document"
  | "user"
  | "speech"
  | "plus"
  | "trash"
  | "pencil"
  | "speech-filled"
  | "calculator"
  | "pin"
  | "gear"
  | "sun"
  | "moon"
  | "smiley";

const Icon = ({ type, size = 24, fill, onClick }: IconProps) => {
  const rkIcons = ["exit", "document", "user", "speech", "speech-filled", "plus"];
  const kyIcons = ["pencil"];
  const bluetipIcons = ["pin"];
  const moneylogsIcons = ["gear", "smiley"]; // drawn in-house

  const iconSet = rkIcons.includes(type)
    ? "reandra-khansa"
    : kyIcons.includes(type)
      ? "kanyayee"
      : bluetipIcons.includes(type)
        ? "bluetip"
        : moneylogsIcons.includes(type)
          ? "moneylogs"
          : "nakals";
  const cssStyles = useMemo(
    () => ({
      height: size ?? undefined,
      width: size ?? undefined,
    }),
    [size],
  );

  // fill="white" means "this icon sits on an inverted block". The colour flip itself
  // is a theme-aware CSS filter (see .Icon--inverse and --icon-filter-inverse).
  return (
    <div
      className={cx("Icon", { handler: onClick, "Icon--inverse": fill === "white" })}
      style={size ? { height: size, width: size } : undefined}
      onClick={onClick}
    >
      <img src={`/icons/${iconSet}-${type}.svg`} style={cssStyles} />
    </div>
  );
};

export const IconText = ({
  text = "",
  type,
  size,
  fill,
  onClick,
  className,
}: {
  type: IconType;
  text?: string;
  size?: number;
  fill?: string;
  onClick?: MouseEventHandler<HTMLDivElement>;
  className?: string;
}) => {
  return (
    <div className={cx("IconText", className)} onClick={onClick}>
      <Icon type={type} size={size} fill={fill} />
      <div className="IconText__text">{text}</div>
    </div>
  );
};

export default Icon;
