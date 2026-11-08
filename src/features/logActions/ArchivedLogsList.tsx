import { useState } from "react";
import { Link } from "react-router-dom";

import { useCurrentUser } from "@/contexts";
import { useUserQuery } from "@/hooks/useUserQuery";
import { Group } from "@/types/user";
import { Ledger } from "@/types/ledger";
import { archivedAtMillis } from "@/utils/archivedLogs";

import "./LogActions.scss";

type ArchivedLogsListProps = {
  groups: ReadonlyArray<Group>;
  ledgers: ReadonlyArray<Ledger>;
};

type Row = { id: string; title: string; href: string; kind: string };

/** Collapsed-by-default list of the logs this user archived, each with an unarchive button. */
export const ArchivedLogsList = ({ groups, ledgers }: ArchivedLogsListProps) => {
  const { user } = useCurrentUser();
  const { unarchiveLog } = useUserQuery();
  const [pendingId, setPendingId] = useState<string | null>(null);

  const rows: Row[] = [
    ...ledgers.map((l) => ({ id: l.id, title: l.title, href: `/l/${l.id}`, kind: "financial" })),
    ...groups.map((g) => ({ id: g.id, title: g.title, href: `/g/${g.id}`, kind: "log group" })),
  ].sort((a, b) => archivedAtMillis(user, b.id) - archivedAtMillis(user, a.id));

  if (rows.length === 0) return null;

  const unarchive = async (logId: string) => {
    if (!user) return;
    setPendingId(logId);
    try {
      await unarchiveLog.mutate({ userId: user.id, logId });
    } catch (err) {
      console.error("Failed to unarchive:", err);
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
            <button
              type="button"
              className="ArchivedLogs__unarchive"
              aria-label={`Unarchive ${row.title}`}
              disabled={pendingId === row.id}
              onClick={() => void unarchive(row.id)}
            >
              {pendingId === row.id ? "…" : "unarchive"}
            </button>
          </li>
        ))}
      </ul>
    </details>
  );
};

export default ArchivedLogsList;
