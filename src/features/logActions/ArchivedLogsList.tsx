import { useState } from "react";
import { Link } from "react-router-dom";

import { useCurrentUser } from "@/contexts";
import { useUserQuery } from "@/hooks/useUserQuery";
import { useToastContext } from "@/hooks/useToastContext";
import { Group } from "@/types/user";
import { Ledger } from "@/types/ledger";
import { archivedAtMillis } from "@/utils/archivedLogs";
import RowButton from "@/components/RowButton";
import { ManageLogButton } from "./ManageLogButton";
import { ManageTarget, manageTargetForGroup, manageTargetForLedger } from "./manageTarget";

import "./LogActions.scss";

type ArchivedLogsListProps = {
  groups: ReadonlyArray<Group>;
  ledgers: ReadonlyArray<Ledger>;
  /**
   * When given, each row gets a "manage" button (unarchive / delete) in place of the
   * plain "unarchive" button, which would only duplicate it.
   */
  onManage?: (target: ManageTarget) => void;
};

type Row = { id: string; title: string; href: string; kind: string; target: ManageTarget };

/** Collapsed-by-default list of the logs this user archived, each with an unarchive or manage button. */
export const ArchivedLogsList = ({ groups, ledgers, onManage }: ArchivedLogsListProps) => {
  const { user } = useCurrentUser();
  const { unarchiveLog } = useUserQuery();
  const { showToast } = useToastContext();
  const [pendingId, setPendingId] = useState<string | null>(null);

  const rows: Row[] = [
    ...ledgers.map((l) => ({
      id: l.id,
      title: l.title,
      href: `/l/${l.id}`,
      kind: "financial",
      target: manageTargetForLedger(l),
    })),
    ...groups.map((g) => ({
      id: g.id,
      title: g.title,
      href: `/g/${g.id}`,
      kind: "log group",
      target: manageTargetForGroup(g),
    })),
  ].sort((a, b) => archivedAtMillis(user, b.id) - archivedAtMillis(user, a.id));

  if (rows.length === 0) return null;

  const unarchive = async (logId: string) => {
    if (!user) return;
    setPendingId(logId);
    try {
      await unarchiveLog.mutate({ userId: user.id, logId });
    } catch (err) {
      console.error("Failed to unarchive:", err);
      showToast("Failed to unarchive. Please try again.");
    } finally {
      setPendingId(null);
    }
  };

  return (
    <details className="ArchivedLogs">
      <summary>Archived ({rows.length})</summary>
      <ul className="ArchivedLogs__list">
        {rows.map((row) => (
          <li key={row.id}>
            <span>
              <Link to={row.href}>{row.title}</Link> <small>{row.kind}</small>
            </span>
            {onManage ? (
              <ManageLogButton target={row.target} onManage={onManage} />
            ) : (
              <RowButton
                aria-label={`Unarchive ${row.title}`}
                disabled={pendingId === row.id}
                onClick={() => void unarchive(row.id)}
              >
                {pendingId === row.id ? "…" : "unarchive"}
              </RowButton>
            )}
          </li>
        ))}
      </ul>
    </details>
  );
};

export default ArchivedLogsList;
