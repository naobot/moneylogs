import { Link } from "react-router-dom";
import dayjs from "dayjs";

import { useCurrentUser } from "@/contexts";
import { useGetCurrentGroups } from "@/hooks/useGetCurrentGroups";
import { useGetMyLedgers } from "@/hooks/useGetMyLedgers";
import { LedgerList } from "@/features/ledger/components/LedgerList";
import { ArchivedLogsList } from "@/features/logActions/ArchivedLogsList";

import GroupArchive from "@/features/moneylog/components/GroupArchive";
import { absoluteStart, absoluteEnd, bySoonestStarting } from "@/utils/groupBoundaries";
import { partitionArchived } from "@/utils/archivedLogs";

// Home lists every log rather than opening the active social group, so financial logs
// (which never end) are always reachable. Logs you've archived move into a collapsed list.
export const Home = () => {
  const { user } = useCurrentUser();
  const { allGroups: groups, isSuccess, isLoading } = useGetCurrentGroups();
  const { ledgers: allLedgers, isLoading: ledgersLoading } = useGetMyLedgers();

  if (isLoading || ledgersLoading) return <div className="InfoBox">...</div>;

  const { active: ledgers, archived: archivedLedgers } = partitionArchived(allLedgers, user);
  const { active: allGroups, archived: archivedGroups } = partitionArchived(
    isSuccess ? groups : [],
    user,
  );
  const now = dayjs();
  const currentGroups = allGroups.filter(
    (g) => !absoluteStart(g).isAfter(now) && !absoluteEnd(g).isBefore(now),
  );
  const upcomingGroups = allGroups.filter((g) => absoluteStart(g).isAfter(now));
  const pastGroups = allGroups.filter((g) => absoluteEnd(g).isBefore(now));
  const hasActive = ledgers.length > 0 || allGroups.length > 0;
  const hasArchived = archivedLedgers.length > 0 || archivedGroups.length > 0;

  if (!hasActive) {
    return (
      <div className="Content__body">
        <h3>
          {hasArchived ? "All your logs are archived" : "You are not currently part of any logs"}
        </h3>
        {!hasArchived && (
          <p>If you know someone participating in one, please wait for their invitation link.</p>
        )}
        <p>
          You can also <Link to="/create">create one</Link> yourself.
        </p>
        <ArchivedLogsList groups={archivedGroups} ledgers={archivedLedgers} />
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

      {allGroups.length > 0 && (
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

      <ArchivedLogsList groups={archivedGroups} ledgers={archivedLedgers} />
    </div>
  );
};
