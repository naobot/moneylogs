import { Link } from "react-router-dom";
import HelpTip from "@/components/HelpTip";
import { useGetMyLedgers } from "@/hooks/useGetMyLedgers";
import { Ledger } from "@/types/ledger";
import { parentInMyLogs } from "@/utils/sublogs";
import "./sublogs.scss";

const SUBLOG_HELP =
  "A sublog is a log whose spending also counts as one line in another log, its parent. You log the detail here, and the parent shows the total. Only spending by people who are in both logs counts.";

/**
 * A small muted line on a sublog's entries view, on the no-spend button's row, saying
 * where it counts:
 * - to a member of the parent: "↳ your spending here counts as bali in personal ›";
 * - to anyone else: that it counts somewhere, without the parent's name (they can't read
 *   that log).
 * A "?" explains what a sublog is. Nothing for a log that isn't a sublog (a parent lists
 * its sublogs in the left column instead).
 */
export const SublogCrumb = ({ ledger }: { ledger: Ledger }) => {
  const link = ledger.parentLink;
  // Only a sublog needs the user's logs, to find its parent among them.
  const { ledgers } = useGetMyLedgers({ enabled: !!link });
  if (!link) return null;

  // The sublog doesn't name its parent: find it among the viewer's own logs.
  const found = parentInMyLogs(ledger, ledgers);
  const parent = found?.parent;
  return (
    <p className="SublogCrumb">
      <span className="SublogName__glyph" aria-hidden="true">
        ↳
      </span>{" "}
      {parent ? (
        <>
          your spending here counts as{" "}
          <Link to={`/l/${parent.id}/stats`} className="keep-case">
            {found?.line?.name ?? ledger.title}
          </Link>{" "}
          in{" "}
          <Link to={`/l/${parent.id}`} className="keep-case">
            {parent.title} ›
          </Link>
        </>
      ) : (
        "a member also counts their spending here in another log"
      )}{" "}
      <HelpTip label="What's a sublog?">{SUBLOG_HELP}</HelpTip>
    </p>
  );
};

export default SublogCrumb;
