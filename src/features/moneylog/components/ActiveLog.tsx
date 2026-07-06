import { Dispatch, useEffect } from "react";

import { Group, LogPost } from "@/types/user";
import { UserData } from "@/hooks/useGetUserInfo";

import LogPosts from "./LogPosts/LogPosts";
import AllLogsDigest from "./LogPosts/AllLogsDigest";

type ActiveLogProps = {
  displayAll: boolean;
  displayUser: UserData;
  logPosts: Array<LogPost>;
  group: Group;
  groupId: string;
  userId: string;
  isCreateNewEntry: boolean;
  isCreateNewEntrySet: Dispatch<React.SetStateAction<boolean>>;
  isMyLog: boolean;
  isReadOnly: boolean;
  isPostingClosed?: boolean;
  isSpectator?: boolean;
};

export const ActiveLog = ({
  displayAll = false,
  displayUser,
  logPosts,
  group: _group,
  groupId,
  userId,
  isCreateNewEntry,
  isCreateNewEntrySet,
  isMyLog = false,
  isReadOnly = false,
  isPostingClosed = false,
  isSpectator = false,
}: ActiveLogProps) => {
  useEffect(() => {
    isCreateNewEntrySet(false);
  }, [userId, groupId]);

  return (
    <>
      {!displayAll && displayUser && (
        <LogPosts
          groupId={groupId}
          user={displayUser}
          userId={userId}
          isMyLog={isMyLog}
          logs={logPosts}
          isCreateNewEntry={isCreateNewEntry}
          isCreateNewEntrySet={isCreateNewEntrySet}
          isReadOnly={isReadOnly}
          isPostingClosed={isPostingClosed}
          isSpectator={isSpectator}
        />
      )}
      {displayAll && (
        <AllLogsDigest
          groupId={groupId}
          logs={logPosts}
          isCreateNewEntrySet={isCreateNewEntrySet}
          isReadOnly={isReadOnly}
          isPostingClosed={isPostingClosed}
          isSpectator={isSpectator}
        />
      )}
    </>
  );
};
