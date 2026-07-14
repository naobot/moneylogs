import { Dispatch, useEffect } from "react";

import { Group, LogPost } from "@/types/user";
import { UserData } from "@/hooks/useGetUserInfo";
import { FullUserData } from "@/hooks/useGetGroupUsers";

import LogPosts from "./LogPosts/LogPosts";
import AllLogsDigest from "./LogPosts/AllLogsDigest";

type ActiveLogProps = {
  displayAll: boolean;
  // Not required for the Daily Digest (displayAll) view, which shows everyone.
  displayUser?: UserData | null;
  logPosts: Array<LogPost>;
  group: Group;
  groupId: string;
  groupMembers: FullUserData[];
  userId?: string;
  isCreateNewEntry: boolean;
  isCreateNewEntrySet: Dispatch<React.SetStateAction<boolean>>;
  isMyLog: boolean;
  isReadOnly: boolean;
  isPostingClosed?: boolean;
  isSpectator?: boolean;
  // Lazy-loading of older posts, only relevant to the scroll-through single-member view.
  hasMorePosts?: boolean;
  isLoadingMorePosts?: boolean;
  onLoadMorePosts?: () => void;
};

export const ActiveLog = ({
  displayAll = false,
  displayUser,
  logPosts,
  group: _group,
  groupId,
  groupMembers,
  userId,
  isCreateNewEntry,
  isCreateNewEntrySet,
  isMyLog = false,
  isReadOnly = false,
  isPostingClosed = false,
  isSpectator = false,
  hasMorePosts = false,
  isLoadingMorePosts = false,
  onLoadMorePosts,
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
          userId={userId ?? displayUser.userId}
          isMyLog={isMyLog}
          logs={logPosts}
          isCreateNewEntry={isCreateNewEntry}
          isCreateNewEntrySet={isCreateNewEntrySet}
          isReadOnly={isReadOnly}
          isPostingClosed={isPostingClosed}
          isSpectator={isSpectator}
          hasMore={hasMorePosts}
          isLoadingMore={isLoadingMorePosts}
          onLoadMore={onLoadMorePosts}
        />
      )}
      {displayAll && (
        <AllLogsDigest
          groupId={groupId}
          logs={logPosts}
          members={groupMembers}
          isCreateNewEntrySet={isCreateNewEntrySet}
          isReadOnly={isReadOnly}
          isPostingClosed={isPostingClosed}
          isSpectator={isSpectator}
        />
      )}
    </>
  );
};
