import { Link } from "react-router-dom";
import dayjs from "dayjs";

import { useGetCurrentGroups } from "@/hooks/useGetCurrentGroups";
import { useGetMyLedgers } from "@/hooks/useGetMyLedgers";
import { LedgerList } from "@/features/ledger/components/LedgerList";

import GroupArchive from "@/features/moneylog/components/GroupArchive";
import { absoluteStart, absoluteEnd, bySoonestStarting } from "@/utils/groupBoundaries";

// Home lists every log rather than opening the active social group, so financial logs
// (which never end) are always reachable. A richer dashboard is planned.
export const Home = () => {
  const { currentGroups, allGroups, isSuccess, isLoading } = useGetCurrentGroups();
  const { ledgers, isLoading: ledgersLoading } = useGetMyLedgers();

  if (isLoading || ledgersLoading) return <div className="InfoBox">...</div>;

  const upcomingGroups = allGroups.filter((g) => absoluteStart(g).isAfter(dayjs()));
  const pastGroups = allGroups.filter((g) => absoluteEnd(g).isBefore(dayjs()));
  const hasAnything = ledgers.length > 0 || (isSuccess && allGroups.length > 0);

  if (!hasAnything) {
    return (
      <div className="Content__body">
        <h3>You are not currently part of any logs</h3>
        <p>If you know someone participating in one, please wait for their invitation link.</p>
        <p>
          You can also <Link to="/create">create one</Link> yourself.
        </p>
      </div>
    );
  }

  return (
    <div className="Content__body Home">
      <p>
        <Link to="/create">+ Start a new log</Link>
      </p>

      <h3>Financial logs</h3>
      {ledgers.length > 0 ? (
        <LedgerList ledgers={ledgers} />
      ) : (
        <p className="GroupArchive__empty">
          You have no financial logs. <Link to="/create">Start one</Link> to track spending by
          category.
        </p>
      )}

      <h3>Ongoing log groups</h3>
      {currentGroups.length > 0 ? (
        <ul>
          {currentGroups.map((g) => (
            <li key={g.id}>
              <Link to={`/g/${g.id}`}>{g.title}</Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="GroupArchive__empty">You are not part of any ongoing log groups.</p>
      )}

      {isSuccess && allGroups.length > 0 && (
        <>
          <h3>Upcoming groups</h3>
          <GroupArchive
            groups={upcomingGroups}
            emptyMessage="You have no upcoming log groups."
            sort={bySoonestStarting}
          />
          <h3>Past groups</h3>
          <GroupArchive groups={pastGroups} emptyMessage="You have no past log groups." />
        </>
      )}
    </div>
  );
};
