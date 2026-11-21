import { Fragment } from "react";
import { Link } from "react-router-dom";
import { useGetMyLedgers } from "@/hooks/useGetMyLedgers";
import { Ledger } from "@/types/ledger";
import { isActiveSublog } from "@/utils/sublogs";
import "./sublogs.scss";

/**
 * One muted line at the top of a ledger saying where it belongs:
 * - a sublog, to a member of the parent: "↳ your spending here counts as bali in personal ›";
 * - a sublog, to anyone else: that it counts somewhere, without the parent's name (they
 *   can't read that log);
 * - a parent: its sublogs, linked where the viewer is a member.
 * Nothing for a log that is neither.
 */
export const SublogCrumb = ({ ledger }: { ledger: Ledger }) => {
  const link = ledger.parentLink;
  const sublogs = (ledger.categories ?? []).filter(isActiveSublog);
  // Only a log that's part of a family needs the user's logs (names, who can open what).
  const { ledgers } = useGetMyLedgers({ enabled: !!link || sublogs.length > 0 });
  if (!link && sublogs.length === 0) return null;

  if (link) {
    const parent = ledgers.find((l) => l.id === link.ledgerId);
    const line = parent?.categories?.find((c) => c.id === link.categoryId)?.name;
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
      </p>
    );
  }

  const mine = new Set(ledgers.map((l) => l.id));
  return (
    <p className="SublogCrumb">
      sublogs:{" "}
      {sublogs.map((c, i) => {
        const childId = c.sublog!.ledgerId;
        return (
          <Fragment key={c.id}>
            {i > 0 && " · "}
            {mine.has(childId) ? (
              <Link to={`/l/${childId}`} className="keep-case">
                {c.name}
              </Link>
            ) : (
              <span className="keep-case">{c.name}</span>
            )}
          </Fragment>
        );
      })}
    </p>
  );
};

export default SublogCrumb;
