import { Fragment } from "react";
import { Link } from "react-router-dom";
import { useGetMyLedgers } from "@/hooks/useGetMyLedgers";
import { Ledger } from "@/types/ledger";
import { isActiveSublog, parentInMyLogs, sublogsInMyLogs } from "@/utils/sublogs";
import "./sublogs.scss";

/**
 * One muted line at the top of a ledger saying where it belongs:
 * - a sublog, to a member of the parent: "↳ your spending here counts as bali in personal ›";
 * - a sublog, to anyone else: that it counts somewhere, without the parent's name (they
 *   can't read that log);
 * - a parent: its sublogs, linked where the viewer is a member.
 * Nothing for a log that is neither.
 */
export const SublogCrumb = ({ ledger, onHelp }: { ledger: Ledger; onHelp?: () => void }) => {
  const link = ledger.parentLink;
  const sublogs = (ledger.categories ?? []).filter(isActiveSublog);
  // Only a log that's part of a family needs the user's logs (names, who can open what).
  const { ledgers } = useGetMyLedgers({ enabled: !!link || sublogs.length > 0 });
  if (!link && sublogs.length === 0) return null;

  const help = onHelp && (
    <>
      {" · "}
      <button type="button" className="SublogHelp" onClick={onHelp}>
        what&apos;s a sublog?
      </button>
    </>
  );

  if (link) {
    // The sublog doesn't name its parent: find it among the viewer's own logs.
    const found = parentInMyLogs(ledger, ledgers);
    const parent = found?.parent;
    const line = found?.line?.name;
    return (
      <p className="SublogCrumb">
        <span className="SublogName__glyph" aria-hidden="true">
          ↳
        </span>{" "}
        {parent ? (
          <>
            your spending here counts as{" "}
            <Link to={`/l/${parent.id}/stats`} className="keep-case">
              {line ?? ledger.title}
            </Link>{" "}
            in{" "}
            <Link to={`/l/${parent.id}`} className="keep-case">
              {parent.title} ›
            </Link>
          </>
        ) : (
          "a member also counts their spending here in another log."
        )}
        {help}
      </p>
    );
  }

  const childOf = sublogsInMyLogs(ledger.categories ?? [], ledgers);
  return (
    <p className="SublogCrumb">
      sublogs:{" "}
      {sublogs.map((c, i) => {
        const childId = childOf.get(c.id);
        return (
          <Fragment key={c.id}>
            {i > 0 && " · "}
            {childId ? (
              <Link to={`/l/${childId}`} className="keep-case">
                {c.name}
              </Link>
            ) : (
              <span className="keep-case">{c.name}</span>
            )}
          </Fragment>
        );
      })}
      {help}
    </p>
  );
};

export default SublogCrumb;
