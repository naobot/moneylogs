import { ReactNode } from "react";
import { Link } from "react-router-dom";
import cx from "classnames";

export type LogCardSize = "large" | "small" | "compact";

type LogCardProps = {
  to: string;
  /** Router state passed along with the link, e.g. which auth view to open. */
  state?: unknown;
  title: string;
  size: LogCardSize;
  /** Small caps label above the title, e.g. "log group" or "financial · shared". */
  kind?: string;
  /** Short facts under the title, one per line. */
  details?: ReactNode[];
  /** New-activity callout, e.g. "3 new posts". Highlights the card. */
  badge?: string;
};

/** One log on the Home dashboard: a rectangle that links into the log. */
export const LogCard = ({ to, state, title, size, kind, details = [], badge }: LogCardProps) => (
  <Link
    to={to}
    state={state}
    className={cx("LogCard", `LogCard--${size}`, { "LogCard--fresh": !!badge })}
    aria-label={badge ? `${title} — ${badge}` : title}
  >
    {(kind || badge) && (
      <span className="LogCard__top">
        {kind && <span className="LogCard__kind">{kind}</span>}
        {badge && <span className="LogCard__badge">{badge}</span>}
      </span>
    )}
    <strong className="LogCard__title">{title}</strong>
    {details.length > 0 && (
      <span className="LogCard__details">
        {details.map((detail, i) => (
          <span key={i}>{detail}</span>
        ))}
      </span>
    )}
  </Link>
);

export default LogCard;
