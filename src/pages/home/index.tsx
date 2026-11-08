import { useMemo } from "react";
import { Link } from "react-router-dom";
import dayjs from "dayjs";

import { useGetCurrentGroups } from "@/hooks/useGetCurrentGroups";
import { useGetMyLedgers } from "@/hooks/useGetMyLedgers";
import { Group } from "@/features/moneylog/components/Group";
import { LedgerList } from "@/features/ledger/components/LedgerList";

import GroupArchive from "@/features/moneylog/components/GroupArchive";
import { absoluteStart, absoluteEnd, bySoonestStarting } from "@/utils/groupBoundaries";

export const Home = () => {
  const { currentGroups, allGroups, isSuccess, isLoading } = useGetCurrentGroups();
  const { ledgers, isLoading: ledgersLoading } = useGetMyLedgers();

  const latestActiveGroup = useMemo(() => {
    return currentGroups?.[0] ?? null;
  }, [currentGroups]);

  const hasLedgers = ledgers.length > 0;
  const loading = isLoading || ledgersLoading;

  // Without any financial logs, keep the original behaviour: the active social group
  // takes over Home. With financial logs, list both kinds (a proper dashboard is planned).
  const showActiveGroupFullscreen = !hasLedgers && !!latestActiveGroup;

  const upcomingAndPast = isSuccess && allGroups.length > 0 && (
    <div>
      <h3>Upcoming groups</h3>
      <GroupArchive
        groups={allGroups.filter((g) => absoluteStart(g).isAfter(dayjs()))}
        emptyMessage="You have no upcoming log groups."
        sort={bySoonestStarting}
      />
      <h3>Past groups</h3>
      <GroupArchive groups={allGroups.filter((g) => absoluteEnd(g).isBefore(dayjs()))} />
    </div>
  );

  return (
    <>
      {loading && <div className="InfoBox">...</div>}
      {!loading && isSuccess && showActiveGroupFullscreen && (
        <Group group={latestActiveGroup} groupId={latestActiveGroup?.id} />
      )}
      {!loading && isSuccess && !showActiveGroupFullscreen && hasLedgers && (
        <div className="Content__body">
          <h3>Financial logs</h3>
          <LedgerList ledgers={ledgers} />
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
          <p>
            <Link to="/create">Start a new log</Link>
          </p>
          {upcomingAndPast}
        </div>
      )}
      {!loading && isSuccess && !showActiveGroupFullscreen && !hasLedgers && (
        <div className="Content__body">
          <h3>You are not currently part of any ongoing log groups</h3>
          <p>If you know someone participating in one, please wait for their invitation link.</p>
          <p>
            You can also <Link to="/create">create one</Link> yourself.
          </p>
          {upcomingAndPast}
        </div>
      )}
    </>
  );
};
