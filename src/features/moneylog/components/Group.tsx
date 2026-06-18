import { useEffect, useMemo, useState } from "react";
import dayjs from "dayjs";
import { Timestamp } from "firebase/firestore";

import { useCurrentUser } from "@/contexts";

import CopyTextArea from "@/features/layout/components/CopyTextArea";
import LogsMenu from "@/features/moneylog/components/LogsMenu";
import { ActiveLog } from "@/features/moneylog/components/ActiveLog";
import { useGetGroupUsers } from "@/hooks/useGetGroupUsers";
import { UserData } from "@/hooks/useGetUserInfo";
import { Group as GroupType } from "@/types/user";
import { useReadTracking } from "@/hooks/useReadTracking";
import { useGetLogPosts } from "@/hooks/useGetLogPosts";
import { useUserQuery } from "@/hooks/useUserQuery";

import Icon, { IconText } from "@/components/Icon";
import LogsSummary from "./LogsSummary/LogsSummary";
import Modal from "@/components/Modal";
import { useUserTimezone } from "./LogPosts/LogPosts";

// Local alias so the call inside conditional JSX doesn't trigger rules-of-hooks
const toTz = useUserTimezone;

export const Group = ({
  group,
  groupId,
  isSpectator = false,
}: {
  group: GroupType;
  groupId: string;
  isSpectator?: boolean;
}) => {
  const { user: loggedInUser } = useCurrentUser();
  // const { pathname } = useLocation()
  const { updateViewTrackingFn } = useUserQuery();
  const { trackUserAction } = useReadTracking();

  const logPostRes = useGetLogPosts({ groupId });

  const [displayAll, setDisplayAll] = useState(isSpectator);
  const [displayUser, setDisplayUser] = useState<UserData | null>(
    isSpectator ? null : (loggedInUser ?? null),
  );
  const [displaySummary, setDisplaySummary] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showEndWarningModal, setShowEndWarningModal] = useState(false);

  const isFutureGroup = useMemo(() => {
    return dayjs(group.start.toDate()).isAfter(dayjs());
  }, [group.start]);

  const endingSoon = useMemo(() => {
    // group ending within 24 hours
    return (group.end as Timestamp).seconds - Timestamp.now().seconds < 86400;
  }, [group]);
  const neverViewedWarningModal = useMemo(() => {
    if (endingSoon) {
      if (
        !localStorage.getItem(`ML__${groupId}__agreeWarning`) ||
        localStorage.getItem(`ML__${groupId}__agreeWarning`) !== "1"
      ) {
        return true;
      }
    }
    return false;
  }, [group, endingSoon, localStorage.getItem(`ML__${groupId}__agreeWarning`)]);

  const [isCreateNewEntry, isCreateNewEntrySet] = useState(false);

  const {
    users: members,
    isLoading: isLoadingMembers,
    userIdToDocRefMap,
  } = useGetGroupUsers(groupId);

  const isReadOnly = useMemo(() => {
    return group.end.toDate() < Timestamp.now().toDate();
  }, [group]);

  const memberIds = useMemo(() => {
    if (!members) return [];
    return members.map((ref) => ref.id);
  }, [groupId, members]);

  const isActiveLogMyLog = useMemo(() => {
    return loggedInUser?.id === displayUser?.id;
  }, [loggedInUser, displayUser]);

  const formatDate = (secondsDate: number, formatString: string) => {
    return dayjs(secondsDate * 1000)?.format(formatString);
  };

  useEffect(() => {
    if (isSpectator) {
      setDisplayAll(true);
      setDisplayUser(null);
    } else if (loggedInUser) {
      setDisplayUser(loggedInUser);
      setDisplayAll(false);
    }
  }, [loggedInUser?.id, groupId, isSpectator]);

  useEffect(() => {
    isCreateNewEntrySet(false);
    setShowInviteModal(false);
  }, [group]);

  useEffect(() => {
    if (
      !localStorage.getItem(`ML__${groupId}__agreeWarning`) ||
      localStorage.getItem(`ML__${groupId}__agreeWarning`) !== "1"
    ) {
      setShowEndWarningModal(endingSoon);
    }
  }, [endingSoon]);

  useEffect(() => {
    trackUserAction("view_group", {
      user_id: loggedInUser?.id,
      group_id: groupId,
    });
  }, [groupId, trackUserAction]);

  useEffect(() => {
    const updateViewTracking = async () => {
      if (isSpectator) return;
      // Only track if we have all required data and user is viewing someone else's logs
      if (!userIdToDocRefMap || userIdToDocRefMap.size === 0) return;
      if (
        !loggedInUser?.userId ||
        !groupId ||
        !displayUser?.userId ||
        !memberIds.includes(displayUser?.id)
      )
        return;

      const viewingUserDocRefId = userIdToDocRefMap.get(loggedInUser.userId);
      const viewedUserDocRefId = userIdToDocRefMap.get(displayUser.userId);

      if (!viewingUserDocRefId || !viewedUserDocRefId) {
        console.error("User not found in map", { viewingUserDocRefId, viewedUserDocRefId });
        return;
      }

      try {
        await updateViewTrackingFn({
          userId: viewingUserDocRefId,
          logGroupId: groupId,
          viewedUserId: viewedUserDocRefId,
        });

        trackUserAction("update_user_last_viewed", {
          user_id: loggedInUser?.id,
          group_id: groupId,
        });
      } catch (error) {
        console.error("Failed to update view tracking:", error);
      }
    };

    updateViewTracking();
  }, [displayUser?.userId, loggedInUser?.userId, groupId]);

  const handleUserChange = (newUser?: unknown) => {
    if (newUser) {
      setDisplayUser(newUser as UserData);
      setDisplayAll(false);
      setDisplaySummary(false);
    } else {
      setDisplayAll(true);
    }

    setTimeout(() => {
      const logPostsContainer = document.querySelector(".LogPosts__posts");

      if (logPostsContainer) {
        logPostsContainer.scrollTo({
          top: 0,
          behavior: "smooth",
        });
      }
    }, 100);
  };

  const handleViewSummary = () => {
    setDisplayUser(null);
    setDisplayAll(false);
    setDisplaySummary(true);

    setTimeout(() => {
      const logPostsContainer = document.querySelector(".LogPosts__posts");

      if (logPostsContainer) {
        logPostsContainer.scrollTo({
          top: 0,
          behavior: "smooth",
        });
      }
    }, 100);
  };

  return (
    <>
      <div className="Group">
        <div className="Group__header">
          <div className="Group__header__left">
            <div className="GroupInterval Group__header__item">
              {group && (
                <div className="Group__header__item__time">
                  {formatDate(group.start?.seconds, "D MMM")}{" "}
                  <small>({dayjs(group.start.toDate()).format("H:mm")})</small> to{" "}
                  {formatDate(group.end?.seconds, "D MMM")}{" "}
                  <small>({dayjs(group.end.toDate()).format("H:mm")})</small>
                </div>
              )}
              {!isReadOnly && endingSoon && (
                <Icon type="warning" fill="white" onClick={() => setShowEndWarningModal(true)} />
              )}
            </div>
          </div>

          <div className="Group__header__center">
            {!isReadOnly && !displayAll && isActiveLogMyLog && !isFutureGroup && !isSpectator && (
              <div
                className="handler Group__header__item"
                onClick={() => {
                  isCreateNewEntrySet(true);
                }}
              >
                <IconText type={"document"} fill={"white"} text="new entry" />
              </div>
            )}
          </div>

          <div className="Group__header__right">
            {!isReadOnly && !isSpectator && group?.members?.length < group?.max_participants && (
              <>
                <div
                  className="handler Group__header__item"
                  onClick={() => {
                    setShowInviteModal(true);
                  }}
                >
                  <IconText type={"plus"} fill={"white"} text="invite" />
                </div>
                <div className="Group__header__item">
                  <small>
                    ({group?.max_participants - group.members?.length} spot
                    {group?.max_participants - group.members?.length > 1 && "s"} left)
                  </small>
                </div>
              </>
            )}
          </div>
        </div>
        <div className="Group__body">
          {/*{(isLoadingGroup || isLoadingMembers) && <>...</>}*/}
          {logPostRes.isSuccess && !isLoadingMembers && groupId && (
            <>
              <LogsMenu
                logMembers={members}
                logPosts={logPostRes.posts}
                displayAll={displayAll}
                displaySummary={displaySummary}
                displayUser={displayUser}
                onChangeUser={handleUserChange}
                onViewSummary={handleViewSummary}
                groupId={groupId}
                isReadOnly={isReadOnly}
              />
              {isFutureGroup && (
                <div className="LogPosts">
                  <div className="LogPosts__error">This group log has not begun yet!</div>
                </div>
              )}
              {!isFutureGroup && displaySummary && (
                <LogsSummary group={group} groupMembers={members} logPosts={logPostRes.posts} />
              )}
              {!isFutureGroup && !displaySummary && displayUser && (
                <ActiveLog
                  group={group}
                  groupId={groupId}
                  logPosts={
                    displayAll
                      ? logPostRes.posts
                      : logPostRes.posts.filter((post) => post.author.id == displayUser.id)
                  }
                  displayAll={displayAll}
                  displayUser={displayUser}
                  userId={displayUser?.userId}
                  isCreateNewEntry={isCreateNewEntry}
                  isCreateNewEntrySet={isCreateNewEntrySet}
                  isMyLog={isActiveLogMyLog}
                  isReadOnly={isReadOnly}
                  isSpectator={isSpectator}
                />
              )}
            </>
          )}
        </div>
      </div>
      <Modal isOpen={showInviteModal} onClose={() => setShowInviteModal(false)}>
        <Modal.Header title={"Invite"}>Invite</Modal.Header>
        <Modal.Body>
          <p>
            Send the following URL to those you want to invite to participate in this log group.
          </p>
          <p>Do not share the group URL with anyone you do not want participating!</p>
          <CopyTextArea value={`${window.location.host}/g/${groupId}/invite`} />
        </Modal.Body>
        <Modal.Actions>
          <Modal.CancelButton text="Close" />
        </Modal.Actions>
      </Modal>
      {!isReadOnly && endingSoon && (showEndWarningModal || neverViewedWarningModal) && (
        <Modal isOpen={showEndWarningModal} onClose={() => setShowEndWarningModal(false)}>
          <Modal.Header title={"Warning"}>Warning</Modal.Header>
          <Modal.Body>
            <p>This moneylog group is ending soon!</p>
            <p>
              All posts and comments will be <strong>read-only</strong> after{" "}
              <strong>
                {toTz((group.end as Timestamp).toDate(), loggedInUser?.timezone).format(
                  "ddd D MMM YYYY HH:mm",
                )}
              </strong>
            </p>
          </Modal.Body>
          <Modal.Actions>
            <Modal.ConfirmButton
              onClick={() => {
                localStorage.setItem(`ML__${groupId}__agreeWarning`, "1");
              }}
              text="OK"
            />
          </Modal.Actions>
        </Modal>
      )}
    </>
  );
};
