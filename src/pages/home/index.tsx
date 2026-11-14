import { Link } from "react-router-dom";

import { useCurrentUser } from "@/contexts";
import { useGetCurrentGroups } from "@/hooks/useGetCurrentGroups";
import { useGetMyLedgers } from "@/hooks/useGetMyLedgers";
import { Dashboard } from "@/features/dashboard/Dashboard";
import { KnickKnackDrawer } from "@/features/dashboard/KnickKnackDrawer";
import { partitionArchived } from "@/utils/archivedLogs";

// Home is a dashboard of what's current. The full history (every past and archived log)
// lives on /me under My logs.
export const Home = () => {
  const { user } = useCurrentUser();
  const { allGroups: groups, isSuccess, isLoading } = useGetCurrentGroups();
  const { ledgers, isLoading: ledgersLoading } = useGetMyLedgers();

  if (isLoading || ledgersLoading) return <div className="InfoBox">...</div>;

  const allGroups = isSuccess ? groups : [];
  const groupParts = partitionArchived(allGroups, user);
  const ledgerParts = partitionArchived(ledgers, user);
  const activeCount = groupParts.active.length + ledgerParts.active.length;
  const archivedCount = groupParts.archived.length + ledgerParts.archived.length;

  const archivedNote =
    archivedCount > 0 ? (
      <p className="GroupArchive__empty">
        {archivedCount} archived log{archivedCount === 1 ? "" : "s"} ·{" "}
        <Link to="/me#logs">see my logs</Link>
      </p>
    ) : null;

  if (activeCount === 0) {
    return (
      <div className="Content__body">
        <h3>
          {archivedCount > 0
            ? "All your logs are archived"
            : "You are not currently part of any logs"}
        </h3>
        {archivedCount === 0 && (
          <p>If you know someone participating in one, please wait for their invitation link.</p>
        )}
        <p>
          You can also <Link to="/create">create one</Link> yourself.
        </p>
        {archivedNote}
        <div className="Dashboard">
          <KnickKnackDrawer ledgers={ledgers} />
        </div>
      </div>
    );
  }

  return (
    <div className="Content__body Home">
      <Dashboard groups={allGroups} ledgers={ledgers} />
      {archivedNote}
    </div>
  );
};
