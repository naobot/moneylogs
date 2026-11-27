import { MouseEventHandler, ReactNode } from "react";
import { Link } from "react-router-dom";
import Icon, { IconType } from "./Icon";
import "./TitleBar.scss";

type TitleBarProps = {
  /** The page's name. Wrap user content (a log's title) in `.keep-case`. */
  title: ReactNode;
  /** Full title for the tooltip when a long one is cut short. */
  titleText?: string;
  /** A muted line beside the title on medium and wide screens ("financial · 2 members"). */
  meta?: ReactNode;
  /** TitleBar.Action buttons, on a paper label at the right. */
  children?: ReactNode;
};

/**
 * Every page's header (2026-11 audit): the chrome of early desktop windows. A 2px frame
 * filled with 1px ink stripes, the title on a paper label at the left and actions on a
 * second label at the right. A log's view toggle sits flush underneath it, sharing the
 * bottom line. Overlays don't use it: a modal's header is the black bar.
 */
const TitleBar = ({ title, titleText, meta, children }: TitleBarProps) => (
  <header className="TitleBar">
    <div className="TitleBar__label">
      <h1 className="TitleBar__title" title={titleText}>
        {title}
      </h1>
      {meta && <span className="TitleBar__meta">{meta}</span>}
    </div>
    {children && <div className="TitleBar__actions">{children}</div>}
  </header>
);

type TitleBarActionProps = {
  /** What it does, in words: the button's name, its tooltip, and its label when wide. */
  label: string;
  icon?: IconType;
  /** A text-mode glyph instead of an icon, e.g. "⋯" for a row of rarer actions. */
  glyph?: string;
  onClick?: MouseEventHandler<HTMLElement>;
  /** A link instead of a button. */
  to?: string;
  "aria-expanded"?: boolean;
  "aria-haspopup"?: "menu" | "dialog";
  className?: string;
};

/**
 * One title-bar action: an icon button on phones and medium screens, icon + word on wide
 * ones. The word is always its accessible name and tooltip.
 */
const TitleBarAction = ({
  label,
  icon,
  glyph,
  onClick,
  to,
  className,
  ...aria
}: TitleBarActionProps) => {
  const content = (
    <>
      {icon && <Icon type={icon} size={20} />}
      {!icon && glyph && (
        <span className="TitleBar__glyph" aria-hidden="true">
          {glyph}
        </span>
      )}
      <span className="TitleBar__word">{label}</span>
    </>
  );
  const shared = {
    className: ["TitleBar__action", className].filter(Boolean).join(" "),
    title: label,
    "aria-label": label,
    ...aria,
  };
  return to ? (
    <Link to={to} onClick={onClick} {...shared}>
      {content}
    </Link>
  ) : (
    <button type="button" onClick={onClick} {...shared}>
      {content}
    </button>
  );
};

TitleBar.Action = TitleBarAction;

export default TitleBar;
