import { useEffect, useMemo, useState } from "react";
import dayjs from "@/utils/configuredDayjs";
import { personalStart, personalEnd, absoluteEnd } from "@/utils/groupBoundaries";

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
import { memberHasUnreadPosts } from "@/utils/unread";

import Icon, { IconText } from "@/components/Icon";
import LogsSummary from "./LogsSummary/LogsSummary";
import Modal from "@/components/Modal";
import TutorialTooltip from "@/components/TutorialTooltip";
import { useTutorial } from "@/contexts/TutorialContext";

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
  const { showNewEntryTip, dismissNewEntryTip, onNewEntryClicked } = useTutorial();

  // Default view: Daily Digest while the group is active, Log Group Summary once
  // it has fully ended (see the reset effect below, which is the source of truth)
  const [displayAll, setDisplayAll] = useState(() => absoluteEnd(group).isAfter(dayjs()));
  const [displayUser, setDisplayUser] = useState<UserData | null>(
    isSpectator ? null : (loggedInUser ?? null),
  );
  const [displaySummary, setDisplaySummary] = useState(() => absoluteEnd(group).isBefore(dayjs()));
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showEndWarningModal, setShowEndWarningModal] = useState(false);

  const isFutureGroup = useMemo(() => {
    return personalStart(group, loggedInUser?.timezone).isAfter(dayjs());
  }, [group, loggedInUser?.timezone]);

  const endingSoon = useMemo(() => {
    const end = personalEnd(group, loggedInUser?.timezone);
    return end.isAfter(dayjs()) && end.diff(dayjs(), "second") < 86400;
  }, [group, loggedInUser?.timezone]);
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

  // Personal end: this user's posting window has closed
  const isPostingClosed = useMemo(() => {
    return personalEnd(group, loggedInUser?.timezone).isBefore(dayjs());
  }, [group, loggedInUser?.timezone]);

  // Absolute end: the group is fully closed for all users in all timezones
  const isReadOnly = useMemo(() => {
    return absoluteEnd(group).isBefore(dayjs());
  }, [group]);

  const logPostRes = useGetLogPosts({ groupId, isArchived: isReadOnly });

  const memberIds = useMemo(() => {
    if (!members) return [];
    return members.map((ref) => ref.id);
  }, [groupId, members]);

  const isActiveLogMyLog = useMemo(() => {
    return loggedInUser?.id === displayUser?.id;
  }, [loggedInUser, displayUser]);

  const userTz = loggedInUser?.timezone || dayjs.tz.guess();
  const displayStart = useMemo(
    () =>
      group.startWallClock ? dayjs.tz(group.startWallClock, userTz) : dayjs(group.start.toDate()),
    [group, userTz],
  );
  const displayEnd = useMemo(
    () => (group.endWallClock ? dayjs.tz(group.endWallClock, userTz) : dayjs(group.end.toDate())),
    [group, userTz],
  );

  useEffect(() => {
    if (isReadOnly) {
      // Completed logs open on the group summary
      setDisplayUser(null);
      setDisplayAll(false);
      setDisplaySummary(true);
      return;
    }
    // Active logs open on the Daily Digest
    if (isSpectator) {
      setDisplayAll(true);
      setDisplayUser(null);
    } else if (loggedInUser) {
      setDisplayUser(loggedInUser);
      setDisplayAll(true);
    }
    setDisplaySummary(false);
  }, [loggedInUser?.id, groupId, isSpectator, isReadOnly]);

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
      // Runs on completed (read-only) groups too: a post notification left unread
      // when the group ended can still be cleared by viewing. The memberHasUnreadPosts
      // guard below keeps this to a single write, so it never returns.
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

      // Your own log never shows a post bell, so tracking your own views is pointless.
      if (viewedUserDocRefId === viewingUserDocRefId) return;

      // Only write when there's genuinely a new post to mark as read; idly clicking
      // back to a member you're caught up on shouldn't touch the database. This also
      // reads false while our own write is still in flight, so the re-runs triggered by
      // `members` landing can't queue a duplicate write.
      const viewedMember = members.find((m) => m.id === viewedUserDocRefId);
      if (
        !memberHasUnreadPosts({
          member: viewedMember,
          viewTracking: loggedInUser.viewTracking,
          groupId,
        })
      ) {
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
    // `members` and `userIdToDocRefMap` belong here, not just the ids: useGetGroupUsers
    // paints from a localStorage cache that omits `lastUpdated`, so an early run sees
    // every member as "nothing new" and skips the write. Without these deps the effect
    // never retries once the real snapshot lands, and the bell stays lit for a log the
    // user already read. Both are identity-stable unless the member set really changed.
  }, [displayUser?.userId, loggedInUser?.userId, groupId, members, userIdToDocRefMap]);

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
                  {displayStart.format("D MMM")} <small>({displayStart.format("H:mm")})</small> to{" "}
                  {displayEnd.format("D MMM")} <small>({displayEnd.format("H:mm")})</small>
                </div>
              )}
              {!isPostingClosed && endingSoon && (
                <Icon type="warning" fill="white" onClick={() => setShowEndWarningModal(true)} />
              )}
            </div>
          </div>

          <div className="Group__header__center">
            {displaySummary && (
              <div className="Group__header__item Group__header__title">
                Insights for {group.title}
              </div>
            )}
            {!isPostingClosed &&
              !displayAll &&
              isActiveLogMyLog &&
              !isFutureGroup &&
              !isSpectator && (
                <div
                  className="handler Group__header__item"
                  style={{ position: "relative" }}
                  onClick={() => {
                    isCreateNewEntrySet(true);
                    onNewEntryClicked();
                  }}
                >
                  {showNewEntryTip && (
                    <TutorialTooltip
                      text="Click here to create your first log post"
                      onDismiss={dismissNewEntryTip}
                      position="bottom"
                    />
                  )}
                  <IconText type={"document"} fill={"white"} text="new entry" />
                </div>
              )}
          </div>

          <div className="Group__header__right">
            {!isPostingClosed &&
              !isSpectator &&
              group?.members?.length < group?.max_participants && (
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
                <LogsSummary
                  group={group}
                  groupMembers={members}
                  logPosts={logPostRes.posts}
                  isLoading={logPostRes.isLoading}
                />
              )}
              {!isFutureGroup && !displaySummary && (displayAll || displayUser) && (
                <ActiveLog
                  group={group}
                  groupId={groupId}
                  logPosts={
                    displayAll
                      ? logPostRes.posts
                      : logPostRes.posts.filter((post) => post.author.id == displayUser?.id)
                  }
                  displayAll={displayAll}
                  displayUser={displayUser}
                  userId={displayUser?.userId}
                  isCreateNewEntry={isCreateNewEntry}
                  isCreateNewEntrySet={isCreateNewEntrySet}
                  isMyLog={isActiveLogMyLog}
                  isReadOnly={isReadOnly}
                  isPostingClosed={isPostingClosed}
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
      {!isPostingClosed && endingSoon && (showEndWarningModal || neverViewedWarningModal) && (
        <Modal isOpen={showEndWarningModal} onClose={() => setShowEndWarningModal(false)}>
          <Modal.Header title={"Warning"}>Warning</Modal.Header>
          <Modal.Body>
            <p>This moneylog group is ending soon!</p>
            <p>
              Your posting window closes at{" "}
              <strong>{displayEnd.format("ddd D MMM YYYY HH:mm")}</strong>.
            </p>
            <p>You can still read and comment for a period after that.</p>
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
