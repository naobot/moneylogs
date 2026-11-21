import { Link } from "react-router-dom";
import "./sublogs.scss";

/** The box-in-box swatch for a category that is another log. */
export const SublogMark = ({ className }: { className?: string }) => (
  <span className={className ? `SublogMark ${className}` : "SublogMark"} aria-hidden="true" />
);

/**
 * A linked category's name: "↳ business ›", a link into the sublog when the viewer is a
 * member of it (`to`), plain text otherwise.
 */
export const SublogName = ({ name, to }: { name: string; to?: string }) => {
  const inner = (
    <>
      <span className="SublogName__glyph" aria-hidden="true">
        ↳
      </span>
      <span className="SublogName__label">{name}</span>
      {to && (
        <span className="SublogName__arrow" aria-hidden="true">
          ›
        </span>
      )}
    </>
  );
  return to ? (
    <Link className="SublogName" to={to} aria-label={`${name}, a sublog: open it`}>
      {inner}
    </Link>
  ) : (
    <span className="SublogName" title={`${name} is a sublog`}>
      {inner}
    </span>
  );
};
