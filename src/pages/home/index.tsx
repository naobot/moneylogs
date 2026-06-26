import { useMemo } from "react";
import { Link } from "react-router-dom";
import dayjs from "dayjs";

import { useGetCurrentGroups } from "@/hooks/useGetCurrentGroups";
import { Group } from "@/features/moneylog/components/Group";

import GroupArchive from "@/features/moneylog/components/GroupArchive";
import { absoluteStart, absoluteEnd } from "@/utils/groupBoundaries";

export const Home = () => {
  const { currentGroups, allGroups, isSuccess, isLoading } = useGetCurrentGroups();

  const latestActiveGroup = useMemo(() => {
    return currentGroups?.[0] ?? null;
  }, [currentGroups]);

  return (
    <>
      {isLoading && <div className="InfoBox">...</div>}
      {!isLoading && isSuccess && latestActiveGroup && (
        <Group group={latestActiveGroup} groupId={latestActiveGroup?.id} />
      )}
      {!isLoading && isSuccess && !latestActiveGroup && (
        <div className="Content__body">
          <h3>You are not currently part of any ongoing log groups</h3>
          <p>If you know someone participating in one, please wait for their invitation link.</p>
          <p>
            You can also <Link to="/create">create one</Link> yourself.
          </p>

          {isSuccess &&
            allGroups.length > 0 && ( // TODO improve this area lol
              <div>
                <h3>Upcoming groups</h3>
                <GroupArchive groups={allGroups.filter((g) => absoluteStart(g).isAfter(dayjs()))} />
                <h3>Past groups</h3>
                <GroupArchive groups={allGroups.filter((g) => absoluteEnd(g).isBefore(dayjs()))} />
              </div>
            )}
        </div>
      )}
    </>
  );
};
