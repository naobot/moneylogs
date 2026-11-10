import { useState } from "react";
import { Link } from "react-router-dom";

import GroupArchive from "@/features/moneylog/components/GroupArchive";
import { LedgerList } from "@/features/ledger/components/LedgerList";
import { ArchivedLogsList } from "@/features/logActions/ArchivedLogsList";
import LogActionsModal from "@/features/logActions/LogActionsModal";
import { ManageTarget } from "@/features/logActions/manageTarget";
import { Group } from "@/types/user";
import { Ledger } from "@/types/ledger";
import { bySoonestEnding, bySoonestStarting } from "@/utils/groupBoundaries";

type MyLogsSectionProps = {
  ledgers: Array<Ledger>;
  ongoing: Array<Group>;
  upcoming: Array<Group>;
  past: Array<Group>;
  archivedGroups: Array<Group>;
  archivedLedgers: Array<Ledger>;
};

/**
 * Every log this user belongs to: the full history that Home only summarises. Each row
 * can be archived or deleted here without opening the log.
 */
export const MyLogsSection = ({
  ledgers,
  ongoing,
  upcoming,
  past,
  archivedGroups,
  archivedLedgers,
}: MyLogsSectionProps) => {
  const [managing, setManaging] = useState<ManageTarget | null>(null);
  const close = () => setManaging(null);

  return (
    <>
      <p>
        <Link to="/create">+ Start a new log</Link>
      </p>

      <div>
        <h4>Financial logs</h4>
        {ledgers.length > 0 ? (
          <LedgerList ledgers={ledgers} onManage={setManaging} />
        ) : (
          <p className="GroupArchive__empty">You have no financial logs.</p>
        )}
      </div>

      <div>
        <h4>Ongoing groups</h4>
        <GroupArchive
          groups={ongoing}
          emptyMessage="You are not part of any ongoing log groups."
          sort={bySoonestEnding}
          onManage={setManaging}
        />
      </div>

      <div>
        <h4>Upcoming groups</h4>
        <GroupArchive
          groups={upcoming}
          emptyMessage="You have no upcoming log groups."
          sort={bySoonestStarting}
          onManage={setManaging}
        />
      </div>

      <div>
        <h4>Past groups</h4>
        <GroupArchive
          groups={past}
          emptyMessage="You have no past log groups."
          onManage={setManaging}
        />
      </div>

      <ArchivedLogsList groups={archivedGroups} ledgers={archivedLedgers} onManage={setManaging} />

      {managing && (
        <LogActionsModal
          // Remount per log so a half-typed delete confirmation never carries over.
          key={managing.id}
          isOpen
          onClose={close}
          // Stay on /me: the deleted log simply drops out of these live lists.
          onDeleted={close}
          logId={managing.id}
          logTitle={managing.title}
          kind={managing.kind}
          creatorUid={managing.creatorUid}
        />
      )}
    </>
  );
};

export default MyLogsSection;
